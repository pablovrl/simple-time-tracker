import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from '../api.config';
import { Subject, tap } from 'rxjs';

export interface TimeEntry {
  id: string;
  taskId: string;
  description: string | null;
  startedAt: string;
  endedAt: string | null;
  hourlyRate: string;
  currency: string;
  amount: string | null;
  taskTitle?: string | null;
  client?: string;
}

export interface UpdateTimeEntry {
  description?: string | null;
  taskId?: string;
  startedAt?: string;
  endedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class TimeEntriesService {
  private readonly updates = new Subject<void>();
  readonly changes = this.updates.asObservable();
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  history(page = 1) {
    return this.http.get<{
      timeEntries: TimeEntry[];
      pagination: { page: number; limit: number; hasMore: boolean };
    }>(`${this.apiUrl}/time-entries`, {
      withCredentials: true,
      params: { page, limit: 20 },
    });
  }

  active() {
    return this.http.get<{ timeEntry: TimeEntry | null }>(`${this.apiUrl}/timer`, {
      withCredentials: true,
    });
  }

  update(id: string, input: UpdateTimeEntry) {
    return this.http
      .patch<{ timeEntry: TimeEntry }>(`${this.apiUrl}/time-entries/${id}`, input, {
        withCredentials: true,
      })
      .pipe(tap(() => this.updates.next()));
  }

  start(input: { taskId: string; description?: string }) {
    return this.http
      .post<{ timeEntry: TimeEntry }>(`${this.apiUrl}/timer/start`, input, {
        withCredentials: true,
      })
      .pipe(tap(() => this.updates.next()));
  }

  stop() {
    return this.http
      .post<{ timeEntry: TimeEntry }>(
        `${this.apiUrl}/timer/stop`,
        {},
        {
          withCredentials: true,
        },
      )
      .pipe(tap(() => this.updates.next()));
  }
}
