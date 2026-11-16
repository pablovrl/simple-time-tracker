import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from '../api.config';

export interface TimeEntry {
  id: string;
  projectId: string;
  taskId: string | null;
  description: string | null;
  startedAt: string;
  endedAt: string | null;
  hourlyRate: string;
  currency: string;
  amount: string | null;
  taskTitle?: string | null;
  projectName?: string;
}

@Injectable({ providedIn: 'root' })
export class TimeEntriesService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  active() {
    return this.http.get<{ timeEntry: TimeEntry | null }>(`${this.apiUrl}/timer`, {
      withCredentials: true,
    });
  }

  start(input: { projectId: string; taskId: string; description: string }) {
    return this.http.post<{ timeEntry: TimeEntry }>(`${this.apiUrl}/timer/start`, input, {
      withCredentials: true,
    });
  }

  stop() {
    return this.http.post<{ timeEntry: TimeEntry }>(
      `${this.apiUrl}/timer/stop`,
      {},
      {
        withCredentials: true,
      },
    );
  }
}
