export interface Message {
  Role: string;
  Text: string;
}

export interface ChatState {
  chats: Message[][];
  activeChat: number;
}

export const STORAGE_KEY = 'litrag.chats';

function defaultState(): ChatState {
  return { chats: [[]], activeChat: 0 };
}

function isMessage(value: unknown): value is Message {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const message = value as Record<string, unknown>;
  return typeof message['Role'] === 'string' && typeof message['Text'] === 'string';
}

function isChat(value: unknown): value is Message[] {
  return Array.isArray(value) && value.every(isMessage);
}

function toChatState(value: unknown): ChatState {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Stored chat state must be an object');
  }

  const state = value as Record<string, unknown>;
  if (!Array.isArray(state['chats']) || state['chats'].length < 1 || !state['chats'].every(isChat)) {
    throw new Error('Stored chats are invalid');
  }

  const chats = state['chats'] as Message[][];
  const activeChat = state['activeChat'];
  if (!Number.isInteger(activeChat) || (activeChat as number) < 0 || (activeChat as number) >= chats.length) {
    console.warn('Stored activeChat is out of range; using the first chat.');
    return { chats, activeChat: 0 };
  }

  return { chats, activeChat: activeChat as number };
}

export function loadChatState(): ChatState {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    console.warn('Unable to read chat state from localStorage.');
    return defaultState();
  }

  if (raw === null) return defaultState();

  try {
    return toChatState(JSON.parse(raw));
  } catch (error) {
    console.warn('Stored chat state is invalid; using defaults.', error);
    return defaultState();
  }
}

export function saveChatState(state: ChatState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    console.warn('Unable to save chat state to localStorage.');
  }
}
