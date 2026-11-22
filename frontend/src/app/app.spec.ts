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
