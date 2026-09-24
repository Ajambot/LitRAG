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

  selectedFile: File | null = null;

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
  }
}
