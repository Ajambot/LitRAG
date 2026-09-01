import { HttpClient } from '@angular/common/http';
import { Component, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Observable } from 'rxjs';

interface Match {
  text: string;
  score: number;
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
  response = signal<String>('');

  onSendClick(query: string): void {
    this.answerQuestion(query).subscribe({
      next: (r) => {
        this.response.set(r);
      },
    });
  }

  getQueryMatches(query: string): Observable<Match[]> {
    return this.http.post<Match[]>('http://localhost:5278/vectordb/query', { query });
  }

  answerQuestion(query: string): Observable<String> {
    return this.http.post<String>('http://localhost:5278/chat', { query });
  }
}
