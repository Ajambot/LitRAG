import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { App } from './app';

describe('App', () => {
  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
    }).compileComponents();
  });

  afterEach(() => vi.restoreAllMocks());

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('renders a delete button for each chat', async () => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('[aria-label^="Delete chat"]').length).toBe(1);
  });

  describe('deleteChat', () => {
    it('does nothing when the confirmation is dismissed', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const app = TestBed.createComponent(App).componentInstance;
      app.chats.set([[], []]);
      app.activeChat.set(1);

      app.deleteChat(0);

      expect(app.chats().length).toBe(2);
      expect(app.activeChat()).toBe(1);
    });

    it('removes the active chat and selects the chat that replaces it', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const app = TestBed.createComponent(App).componentInstance;
      app.chats.set([[], [{ Role: 'user', Text: 'first' }], [{ Role: 'user', Text: 'second' }]]);
      app.activeChat.set(1);

      app.deleteChat(1);

      expect(app.chats()).toEqual([[], [{ Role: 'user', Text: 'second' }]]);
      expect(app.activeChat()).toBe(1);
    });

    it('keeps the active chat when an earlier chat is deleted', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const app = TestBed.createComponent(App).componentInstance;
      app.chats.set([[], [], []]);
      app.activeChat.set(2);

      app.deleteChat(0);

      expect(app.chats().length).toBe(2);
      expect(app.activeChat()).toBe(1);
    });

    it('keeps the active chat when a later chat is deleted', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const app = TestBed.createComponent(App).componentInstance;
      app.chats.set([[], [], []]);
      app.activeChat.set(0);

      app.deleteChat(2);

      expect(app.chats().length).toBe(2);
      expect(app.activeChat()).toBe(0);
    });

    it('selects the last chat when the active chat is the last one deleted', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const app = TestBed.createComponent(App).componentInstance;
      app.chats.set([[], [], []]);
      app.activeChat.set(2);

      app.deleteChat(2);

      expect(app.chats().length).toBe(2);
      expect(app.activeChat()).toBe(1);
    });

    it('keeps a single empty chat when the last remaining chat is deleted', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const app = TestBed.createComponent(App).componentInstance;
      app.chats.set([[{ Role: 'user', Text: 'only' }]]);
      app.activeChat.set(0);

      app.deleteChat(0);

      expect(app.chats()).toEqual([[]]);
      expect(app.activeChat()).toBe(0);
    });

    it('persists the updated state', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      const fixture = TestBed.createComponent(App);
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

  beforeEach(async () => {
    localStorage.clear();
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    vi.restoreAllMocks();
  });

  it('loads the file list on init', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();

    const req = httpMock.expectOne('http://localhost:5278/files');
    expect(req.request.method).toBe('GET');
    req.flush(['paper-a.pdf', 'paper-b.pdf']);
    expect(fixture.componentInstance.files()).toEqual(['paper-a.pdf', 'paper-b.pdf']);
  });

  it('renders each imported file with a delete button', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.files.set(['paper-a.pdf', 'paper-b.pdf']);
    await fixture.whenStable();
    httpMock.expectOne('http://localhost:5278/files').flush([]);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelectorAll('[aria-label^="Delete file"]').length).toBe(2);
    expect(compiled.textContent).toContain('paper-a.pdf');
  });

  it('shows an empty state when no files are imported', async () => {
    const fixture = TestBed.createComponent(App);
    fixture.componentInstance.files.set([]);
    await fixture.whenStable();
    httpMock.expectOne('http://localhost:5278/files').flush([]);

    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.textContent).toContain('No files imported yet.');
  });

  it('does not delete when the confirmation is dismissed', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const app = TestBed.createComponent(App).componentInstance;
    app.files.set(['paper-a.pdf']);

    app.deleteFile('paper-a.pdf');

    httpMock.expectNone('http://localhost:5278/files/paper-a.pdf');
    expect(app.files()).toEqual(['paper-a.pdf']);
  });

  it('deletes a confirmed file and refreshes the list', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const app = TestBed.createComponent(App).componentInstance;
    app.files.set(['paper-a.pdf']);

    app.deleteFile('paper-a.pdf');

    const del = httpMock.expectOne('http://localhost:5278/files/paper-a.pdf');
    expect(del.request.method).toBe('DELETE');
    del.flush(null, { status: 204, statusText: 'No Content' });

    httpMock.expectOne('http://localhost:5278/files').flush([]);
    expect(app.files()).toEqual([]);
  });

  it('refreshes the list after a successful upload', () => {
    const app = TestBed.createComponent(App).componentInstance;
    const file = new File(['dummy'], 'new-paper.pdf', { type: 'application/pdf' });
    app.onFileSelect({ target: { files: [file] } } as unknown as Event);

    app.onSubmit();

    const upload = httpMock.expectOne('http://localhost:5278/research-article');
    expect(upload.request.method).toBe('POST');
    upload.flush({});

    httpMock.expectOne('http://localhost:5278/files').flush(['new-paper.pdf']);
    expect(app.files()).toEqual(['new-paper.pdf']);
  });
});
