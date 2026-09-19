import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
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
export class App {
  protected readonly title = signal('frontend');
  private http = inject(HttpClient);
  matches = signal<Match[]>([]);
  msgs = signal<Message[]>([]);

  onSendClick(query: string): void {
    this.msgs.set([...this.msgs(), { Role: 'user', Text: query }]);
    this.answerQuestion(this.msgs()).subscribe({
      next: (r) => {
        this.msgs.set([...this.msgs(), { Role: 'assistant', Text: r }]);
      },
    });
  }

  getQueryMatches(query: string): Observable<Match[]> {
    return this.http.post<Match[]>('http://localhost:5278/vectordb/query', { query });
  }

  answerQuestion(query: Message[]): Observable<string> {
    return this.http.post<string>('http://localhost:5278/chat', { Conversation: query });
  }
}
