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

  onSendClick(query: string): void {
    this.getQueryMatches(query).subscribe({
      next: (response) => {
        this.matches.set(response);
      },
    });
  }

  getQueryMatches(query: string): Observable<Match[]> {
    return this.http.post<Match[]>('http://localhost:5278/vectordb/query', { query });
  }
}
