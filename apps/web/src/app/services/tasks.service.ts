import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from '../api.config';

export interface Task {
  id: string;
  projectId: string;
  projectName: string;
  title: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'done';
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class TasksService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/tasks`;

  list() {
    return this.http.get<{ tasks: Task[] }>(this.url, { withCredentials: true });
  }

  create(input: { projectId: string; title: string; description?: string }) {
    return this.http.post<{ task: Task }>(this.url, input, { withCredentials: true });
  }
}
