import { HttpClient } from '@angular/common/http';
import { Component, effect, inject, OnDestroy, OnInit, signal } from '@angular/core';
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

  selectedFile: File | null = null;
  private pollTimer?: ReturnType<typeof setTimeout>;

  constructor() {
    const state = loadChatState();
    this.chats.set(state.chats);
    this.activeChat.set(state.activeChat);
    effect(() => saveChatState({ chats: this.chats(), activeChat: this.activeChat() }));
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

  createChat() {
    this.chats.set([...this.chats(), []]);
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

    this.chats.set(chats);
    this.activeChat.set(activeChat);
  }

  addMessageToChat(msg: string, role: string, idx: number) {
    let chats = this.chats();
    let curChat = chats[idx];
    curChat = [...curChat, { Role: role, Text: msg }];
    chats[idx] = curChat;
    this.chats.set(chats);
  }

  selectChat(idx: number) {
    this.activeChat.set(idx);
  }

  onSendClick(query: string): void {
    let actChat = this.activeChat();
    this.addMessageToChat(query, 'user', actChat);
    this.answerQuestion(this.chats()[actChat]).subscribe({
      next: (r) => {
        this.addMessageToChat(r, 'assistant', actChat);
      },
    });
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
    const file = element.files?.[0] ?? null;
    element.value = '';
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
