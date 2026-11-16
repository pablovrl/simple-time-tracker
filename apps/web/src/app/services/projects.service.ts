import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from '../api.config';

export interface Project {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  hourlyRate: string;
  currency: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateProject {
  name: string;
  description?: string;
  hourlyRate: string;
  currency: string;
}

export interface ProjectsPage {
  projects: Project[];
  pagination: { page: number; limit: number; hasMore: boolean };
}

@Injectable({ providedIn: 'root' })
export class ProjectsService {
  private readonly http = inject(HttpClient);
  private readonly url = `${inject(API_URL)}/projects`;

  list(page = 1) {
    return this.http.get<ProjectsPage>(this.url, {
      withCredentials: true,
      params: { page, limit: 20, status: 'active' },
    });
  }

  create(input: CreateProject) {
    return this.http.post<{ project: Project }>(this.url, input, { withCredentials: true });
  }
}
