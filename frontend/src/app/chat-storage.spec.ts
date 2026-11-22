import { loadChatState, saveChatState, STORAGE_KEY } from './chat-storage';

const defaultState = { chats: [[]], activeChat: 0 };

const savedState = {
  chats: [
    [
      { Role: 'user', Text: 'hello' },
      { Role: 'assistant', Text: 'hi' },
    ],
    [{ Role: 'user', Text: 'second chat' }],
  ],
  activeChat: 1,
};

describe('chat storage', () => {
  beforeEach(() => localStorage.clear());

  it('round trips a saved state', () => {
    saveChatState(savedState);
    expect(loadChatState()).toEqual(savedState);
  });

  it('returns the default state when the key is missing', () => {
    expect(loadChatState()).toEqual(defaultState);
  });

  it('returns the default state for malformed JSON', () => {
    localStorage.setItem(STORAGE_KEY, '{not json');
    expect(loadChatState()).toEqual(defaultState);
  });

  it.each([
    ['a raw array', '[]'],
    ['null', 'null'],
    ['missing chats', '{"activeChat":0}'],
    ['empty chats', '{"chats":[],"activeChat":0}'],
    ['a chat that is not an array', '{"chats":[{}],"activeChat":0}'],
    ['a non-string Role', '{"chats":[[{"Role":1,"Text":"x"}]],"activeChat":0}'],
    ['a non-string Text', '{"chats":[[{"Role":"user","Text":1}]],"activeChat":0}'],
  ])('returns the default state for %s', (_label, raw) => {
    localStorage.setItem(STORAGE_KEY, raw);
    expect(loadChatState()).toEqual(defaultState);
  });

  it.each([-1, 1.5, 2])('clamps out-of-range activeChat %s to 0', (activeChat) => {
    const chats = [[{ Role: 'user', Text: 'hello' }], []];
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ chats, activeChat }));
    expect(loadChatState()).toEqual({ chats, activeChat: 0 });
  });

  it('does not throw when setItem fails', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    try {
      expect(() => saveChatState(savedState)).not.toThrow();
    } finally {
      spy.mockRestore();
    }
  });

  it('returns the default state when getItem throws', () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    try {
      expect(loadChatState()).toEqual(defaultState);
    } finally {
      spy.mockRestore();
    }
  });
});
