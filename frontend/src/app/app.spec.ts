import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { App, ImportedFile } from './app';

const importedFile = (name: string, status: string, error?: string): ImportedFile =>
  error ? { name, status, error } : { name, status };

describe('App', () => {
  let fixtures: ComponentFixture<App>[];

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    fixtures = [];
  });

  afterEach(() => {
    fixtures.forEach(fixture => fixture.destroy());
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function createFixture(): ComponentFixture<App> {
    const fixture = TestBed.createComponent(App);
    fixtures.push(fixture);
    return fixture;
  }

  it('should create the app', () => {
    expect(createFixture().componentInstance).toBeTruthy();
  });

  it('renders a delete button for each chat', async () => {
    const fixture = createFixture();
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('http://localhost:5278/files').flush([]);
    await fixture.whenStable();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('[aria-label^="Delete chat"]').length).toBe(1);
  });

  describe('deleteChat', () => {
    it('does nothing when the confirmation is dismissed', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const app = createFixture().componentInstance;
      app.chats.set([[], []]);
      app.activeChat.set(1);

      app.deleteChat(0);

      expect(app.chats().length).toBe(2);
      expect(app.activeChat()).toBe(1);
    });

    it('removes the active chat and selects the chat that replaces it', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const app = createFixture().componentInstance;
      app.chats.set([[], [{ Role: 'user', Text: 'first' }], [{ Role: 'user', Text: 'second' }]]);
      app.activeChat.set(1);

      app.deleteChat(1);

      expect(app.chats()).toEqual([[], [{ Role: 'user', Text: 'second' }]]);
      expect(app.activeChat()).toBe(1);
    });

    it('keeps the active chat when an earlier chat is deleted', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const app = createFixture().componentInstance;
      app.chats.set([[], [], []]);
      app.activeChat.set(2);

      app.deleteChat(0);

      expect(app.chats().length).toBe(2);
      expect(app.activeChat()).toBe(1);
    });

    it('keeps the active chat when a later chat is deleted', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const app = createFixture().componentInstance;
      app.chats.set([[], [], []]);
      app.activeChat.set(0);

      app.deleteChat(2);

      expect(app.chats().length).toBe(2);
      expect(app.activeChat()).toBe(0);
    });

    it('selects the last chat when the active chat is the last one deleted', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const app = createFixture().componentInstance;
      app.chats.set([[], [], []]);
      app.activeChat.set(2);

      app.deleteChat(2);

      expect(app.chats().length).toBe(2);
      expect(app.activeChat()).toBe(1);
    });

    it('keeps a single empty chat when the last remaining chat is deleted', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const app = createFixture().componentInstance;
      app.chats.set([[{ Role: 'user', Text: 'only' }]]);
      app.activeChat.set(0);

      app.deleteChat(0);

      expect(app.chats()).toEqual([[]]);
      expect(app.activeChat()).toBe(0);
    });

    it('persists the updated state', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const fixture = createFixture();
      const app = fixture.componentInstance;
      app.chats.set([[], []]);
      app.activeChat.set(0);

      app.deleteChat(1);
      fixture.detectChanges();

      expect(JSON.parse(localStorage.getItem('litrag.chats')!)).toEqual({ chats: [[]], activeChat: 0 });
    });
  });
});

describe('App imported files', () => {
  let httpMock: HttpTestingController;
  let fixtures: ComponentFixture<App>[];

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
    fixtures = [];
  });

  afterEach(() => {
    fixtures.forEach(fixture => fixture.destroy());
    httpMock.verify();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function createFixture(files: ImportedFile[] = []): ComponentFixture<App> {
    const fixture = TestBed.createComponent(App);
    fixtures.push(fixture);
    fixture.detectChanges();
    httpMock.expectOne('http://localhost:5278/files').flush(files);
    fixture.detectChanges();
    return fixture;
  }

  it('loads the file list with statuses on init', () => {
    const fixture = createFixture([
      importedFile('paper-a.pdf', 'Ready'),
      importedFile('paper-b.pdf', 'Indexing'),
    ]);

    expect(fixture.componentInstance.files()).toEqual([
      importedFile('paper-a.pdf', 'Ready'),
      importedFile('paper-b.pdf', 'Indexing'),
    ]);
  });

  it('renders a status badge for each imported file', () => {
    const fixture = createFixture([
      importedFile('paper-a.pdf', 'Ready'),
      importedFile('paper-b.pdf', 'Indexing'),
    ]);

    const badges = (fixture.nativeElement as HTMLElement).querySelectorAll('.status-badge');
    expect(badges.length).toBe(2);
    expect(badges[0].textContent?.trim()).toBe('Ready');
    expect(badges[1].textContent?.trim()).toBe('Indexing');
  });

  it('hides the delete button while Queued or Indexing', () => {
    const fixture = createFixture([
      importedFile('queued.pdf', 'Queued'),
      importedFile('indexing.pdf', 'Indexing'),
    ]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('[aria-label^="Delete file"]').length).toBe(0);
    expect(compiled.textContent).toContain('queued.pdf');
    expect(compiled.textContent).toContain('indexing.pdf');
  });

  it('shows the delete button for Ready and Failed files', () => {
    const fixture = createFixture([
      importedFile('ready.pdf', 'Ready'),
      importedFile('failed.pdf', 'Failed'),
    ]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('[aria-label^="Delete file"]').length).toBe(2);
  });

  it('shows only Failed for a failed file, without the error detail', () => {
    const fixture = createFixture([
      importedFile('broken.pdf', 'Failed', 'OPENROUTER_KEY is not set'),
    ]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Failed');
    expect(compiled.textContent).not.toContain('OPENROUTER_KEY is not set');
  });

  it('shows an empty state when no files are imported', () => {
    const fixture = createFixture();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('No files imported yet.');
  });

  it('does not delete when the confirmation is dismissed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const app = createFixture([importedFile('paper-a.pdf', 'Ready')]).componentInstance;

    app.deleteFile('paper-a.pdf');

    httpMock.expectNone('http://localhost:5278/files/paper-a.pdf');
    expect(app.files()).toEqual([importedFile('paper-a.pdf', 'Ready')]);
  });

  it('deletes a confirmed file and refreshes the list', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const app = createFixture([importedFile('paper-a.pdf', 'Ready')]).componentInstance;

    app.deleteFile('paper-a.pdf');

    const del = httpMock.expectOne('http://localhost:5278/files/paper-a.pdf');
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });

    httpMock.expectOne('http://localhost:5278/files').flush([]);
    expect(app.files()).toEqual([]);
  });

  it('uploads a new file and refreshes the list', () => {
    const app = createFixture().componentInstance;
    const file = new File(['dummy'], 'new-paper.pdf', { type: 'application/pdf' });
    app.onFileSelect({ target: { files: [file] } } as unknown as Event);

    const upload = httpMock.expectOne('http://localhost:5278/research-article');
    expect(upload.request.method).toBe('POST');
    upload.flush({});

    httpMock.expectOne('http://localhost:5278/files').flush([importedFile('new-paper.pdf', 'Queued')]);
    expect(app.files()).toEqual([importedFile('new-paper.pdf', 'Queued')]);
  });

  it('asks for confirmation before replacing an existing file', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true);
    const app = createFixture([importedFile('paper-a.pdf', 'Ready')]).componentInstance;
    const file = new File(['dummy'], 'paper-a.pdf', { type: 'application/pdf' });

    app.onFileSelect({ target: { files: [file] } } as unknown as Event);

    expect(confirm).toHaveBeenCalledWith(
      'Replace paper-a.pdf and reindex it? Existing vectors will be replaced.',
    );
    httpMock.expectOne('http://localhost:5278/research-article').flush({});
    httpMock.expectOne('http://localhost:5278/files').flush([importedFile('paper-a.pdf', 'Queued')]);
  });

  it('does not upload a replacement when the confirmation is dismissed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const app = createFixture([importedFile('paper-a.pdf', 'Ready')]).componentInstance;
    const file = new File(['dummy'], 'paper-a.pdf', { type: 'application/pdf' });

    app.onFileSelect({ target: { files: [file] } } as unknown as Event);

    httpMock.expectNone('http://localhost:5278/research-article');
  });

  it('blocks re-import while a file is indexing', () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => {});
    const app = createFixture([importedFile('paper-a.pdf', 'Indexing')]).componentInstance;
    const file = new File(['dummy'], 'paper-a.pdf', { type: 'application/pdf' });

    app.onFileSelect({ target: { files: [file] } } as unknown as Event);

    expect(alert).toHaveBeenCalled();
    httpMock.expectNone('http://localhost:5278/research-article');
  });

  it('disables chat when no file is Ready', () => {
    const fixture = createFixture([importedFile('paper-a.pdf', 'Indexing')]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('Import a file to start asking questions');
    expect((compiled.querySelector('#chatbox') as HTMLTextAreaElement).disabled).toBe(true);
    const send = [...compiled.querySelectorAll('button')].find(b => b.textContent?.includes('Send'))!;
    expect((send as HTMLButtonElement).disabled).toBe(true);
  });

  it('enables chat when a file is Ready', () => {
    const fixture = createFixture([importedFile('paper-a.pdf', 'Ready')]);
    fixture.detectChanges();

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).not.toContain('Import a file to start asking questions');
    expect((compiled.querySelector('#chatbox') as HTMLTextAreaElement).disabled).toBe(false);
  });

  it('polls while a file is non-terminal and stops once all files are terminal', () => {
    vi.useFakeTimers();
    const app = createFixture([importedFile('paper-a.pdf', 'Queued')]).componentInstance;

    vi.advanceTimersByTime(app.pollIntervalMs);
    const next = httpMock.expectOne('http://localhost:5278/files');
    expect(next.request.method).toBe('GET');
    next.flush([importedFile('paper-a.pdf', 'Indexing')]);

    vi.advanceTimersByTime(app.pollIntervalMs);
    httpMock.expectOne('http://localhost:5278/files').flush([importedFile('paper-a.pdf', 'Ready')]);

    vi.advanceTimersByTime(app.pollIntervalMs * 5);
    httpMock.expectNone('http://localhost:5278/files');
    expect(app.files()).toEqual([importedFile('paper-a.pdf', 'Ready')]);
  });
});
