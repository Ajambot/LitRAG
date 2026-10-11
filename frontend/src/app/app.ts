import { HttpClient } from '@angular/common/http';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Observable } from 'rxjs';

interface Match {
  text: string;
  score: number;
}

interface Message {
  Role: string;
  Text: string;
}

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly title = signal('frontend');
  private http = inject(HttpClient);
  matches = signal<Match[]>([]);
  chats = signal<Message[][]>([[]]);
  activeChat = signal<number>(0);
  numFiles = signal<number>(0);

  selectedFile: File | null = null;

  ngOnInit() {
    this.getNumFiles().subscribe({
      next: (r) => {
        this.numFiles.set(r);
      },
    });
  }

  createChat() {
    this.chats.set([...this.chats(), []]);
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

  getNumFiles(): Observable<number> {
    return this.http.get<number>('http://localhost:5278/files');
  }

  onFileSelect(event: Event) {
    const element = event.target as HTMLInputElement;
    if (element.files) this.selectedFile = element.files[0];
  }

  onSubmit(): void {
    if (!this.selectedFile) {
      alert('Please select a file first!');
      return;
    }

    const formData = new FormData();

    formData.append('file', this.selectedFile, this.selectedFile.name);

    const externalUrl = 'http://localhost:5278/research-article';

    this.http.post(externalUrl, formData).subscribe({
      next: (response) => {
        alert('Upload complete:');
      },
      error: (error) => {
        alert('Error in upload: ' + error);
      },
    });

    this.getNumFiles().subscribe({
      next: (r) => {
        this.numFiles.set(r);
      },
    });
  }
}
