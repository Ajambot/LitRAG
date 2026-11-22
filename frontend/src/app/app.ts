import { HttpClient } from '@angular/common/http';
import {
  afterRenderEffect,
  Component,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Observable } from 'rxjs';
import { loadChatState, Message, saveChatState } from './chat-storage';

interface Match {
  text: string;
  score: number;
}

export interface ImportedFile {
  name: string;
  status: string;
  error?: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  protected readonly title = signal('frontend');
  private http = inject(HttpClient);
  matches = signal<Match[]>([]);
  chats = signal<Message[][]>([[]]);
  activeChat = signal<number>(0);
  files = signal<ImportedFile[]>([]);
  pollIntervalMs = 1000;

  sendingChat = signal<number | null>(null);
  chatError = signal<{ chat: number; message: string } | null>(null);
  mobilePanel = signal<'none' | 'chats' | 'files'>('none');

  readonly suggestions = [
    'Summarize the key findings',
    'What methods did the authors use?',
    'Compare the results across papers',
  ];

  private messageScroll = viewChild<ElementRef<HTMLElement>>('messageScroll');
  private chatbox = viewChild<ElementRef<HTMLTextAreaElement>>('chatbox');

  selectedFile: File | null = null;
  private pollTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const state = loadChatState();
    this.chats.set(state.chats);
    this.activeChat.set(state.activeChat);
    effect(() => saveChatState({ chats: this.chats(), activeChat: this.activeChat() }));

    afterRenderEffect(() => {
      this.chats();
      this.activeChat();
      this.sendingChat();
      const el = this.messageScroll()?.nativeElement;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }

  ngOnInit() {
    this.refreshFiles();
  }

  ngOnDestroy() {
    this.stopPolling();
  }

  isTerminal(status: string): boolean {
    return status === 'Ready' || status === 'Failed';
  }

  hasReadyFile(): boolean {
    return this.files().some(file => file.status === 'Ready');
  }

  isSending(): boolean {
    return this.sendingChat() !== null;
  }

  currentMessages(): Message[] {
    return this.chats()[this.activeChat()] ?? [];
  }

  chatTitle(chat: Message[], idx: number): string {
    const first = chat.find(message => message.Role === 'user');
    if (!first) return 'New conversation';
    const text = first.Text.trim().replace(/\s+/g, ' ');
    return text.length > 34 ? `${text.slice(0, 34).trimEnd()}…` : text;
  }

  chatPreview(chat: Message[]): string {
    if (chat.length === 0) return 'No messages yet';
    const last = chat[chat.length - 1];
    const text = last.Text.trim().replace(/\s+/g, ' ');
    const prefix = last.Role === 'user' ? 'You: ' : '';
    return prefix + (text.length > 40 ? `${text.slice(0, 40).trimEnd()}…` : text);
  }

  createChat() {
    const chats = [...this.chats(), []];
    this.chats.set(chats);
    this.activeChat.set(chats.length - 1);
    this.mobilePanel.set('none');
  }

  deleteChat(idx: number) {
    if (!confirm(`Delete chat ${idx}? This cannot be undone.`)) return;

    const chats = this.chats().filter((_, i) => i !== idx);
    if (chats.length === 0) {
      this.chats.set([[]]);
      this.activeChat.set(0);
      return;
    }

    let activeChat = this.activeChat();
    if (idx < activeChat) activeChat--;
    else if (idx === activeChat) activeChat = Math.min(activeChat, chats.length - 1);

    if (this.sendingChat() === idx) this.sendingChat.set(null);
    if (this.chatError()?.chat === idx) this.chatError.set(null);

    this.chats.set(chats);
    this.activeChat.set(activeChat);
  }

  addMessageToChat(msg: string, role: string, idx: number) {
    this.chats.set(
      this.chats().map((chat, i) => (i === idx ? [...chat, { Role: role, Text: msg }] : chat)),
    );
  }

  selectChat(idx: number) {
    this.activeChat.set(idx);
    this.mobilePanel.set('none');
  }

  clearChatbox() {
    const box = this.chatbox()?.nativeElement;
    if (box) {
      box.value = '';
      box.focus();
    }
  }

  usePrompt(prompt: string) {
    const box = this.chatbox()?.nativeElement;
    if (!box) return;
    box.value = prompt;
    box.focus();
  }

  onChatKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.sendMessage();
    }
  }

  sendMessage() {
    const box = this.chatbox()?.nativeElement;
    const text = box?.value ?? '';
    if (!text.trim()) return;
    if (box) box.value = '';
    this.onSendClick(text.trim());
  }

  onSendClick(query: string): void {
    if (this.isSending() || !query.trim() || !this.hasReadyFile()) return;

    const actChat = this.activeChat();
    this.chatError.set(null);
    this.addMessageToChat(query, 'user', actChat);
    this.sendingChat.set(actChat);

    this.answerQuestion(this.chats()[actChat]).subscribe({
      next: (r) => {
        this.addMessageToChat(r, 'assistant', actChat);
        if (this.sendingChat() === actChat) this.sendingChat.set(null);
      },
      error: (error) => {
        console.error('Error answering question: ' + error);
        if (this.sendingChat() === actChat) this.sendingChat.set(null);
        this.chatError.set({
          chat: actChat,
          message: 'LitRAG could not reach the server. Check the connection and try again.',
        });
      },
    });
  }

  dismissError() {
    this.chatError.set(null);
  }

  getQueryMatches(query: string): Observable<Match[]> {
    return this.http.post<Match[]>('http://localhost:5278/vectordb/query', { query });
  }

  answerQuestion(query: Message[]): Observable<string> {
    return this.http.post<string>('http://localhost:5278/chat', { Conversation: query });
  }

  refreshFiles(): void {
    this.getFiles().subscribe({
      next: (r) => {
        this.files.set(Array.isArray(r) ? r : []);
        this.schedulePolling();
      },
      error: (error) => console.error('Error loading files: ' + error),
    });
  }

  getFiles(): Observable<ImportedFile[]> {
    return this.http.get<ImportedFile[]>('http://localhost:5278/files');
  }

  private schedulePolling(): void {
    this.stopPolling();
    if (this.files().some(file => !this.isTerminal(file.status))) {
      this.pollTimer = setTimeout(() => this.refreshFiles(), this.pollIntervalMs);
    }
  }

  private stopPolling(): void {
    if (this.pollTimer !== undefined) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
    }
  }

  deleteFile(fileName: string): void {
    if (!confirm(`Delete ${fileName}? This cannot be undone.`)) return;

    const url = `http://localhost:5278/files/${encodeURIComponent(fileName)}`;
    this.http.delete(url).subscribe({
      next: () => this.refreshFiles(),
      error: (error) => alert('Error deleting file: ' + error),
    });
  }

  onFileSelect(event: Event): void {
    const element = event.target as HTMLInputElement;
    this.handleFile(element.files?.[0] ?? null);
    element.value = '';
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.handleFile(event.dataTransfer?.files?.[0] ?? null);
  }

  private handleFile(file: File | null): void {
    this.selectedFile = null;

    if (file) {
      const existing = this.files().find(imported => imported.name === file.name);
      if (existing && !this.isTerminal(existing.status)) {
        alert(`${file.name} is still being indexed. Please wait until it finishes.`);
      } else if (
        !existing ||
        confirm(`Replace ${file.name} and reindex it? Existing vectors will be replaced.`)
      ) {
        this.selectedFile = file;
        this.onSubmit();
      }
    }

    this.selectedFile = null;
  }

  onSubmit(): void {
    if (!this.selectedFile) {
      alert('Please select a file first!');
      return;
    }

    const formData = new FormData();
    formData.append('file', this.selectedFile, this.selectedFile.name);

    this.http.post('http://localhost:5278/research-article', formData).subscribe({
      next: () => {
        this.selectedFile = null;
        this.refreshFiles();
      },
      error: (error) => {
        alert('Error in upload: ' + error);
      },
    });
  }
}
