import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_URL } from '../api.config';

export interface DashboardSummary {
  workedSeconds: number;
  earnings: { currency: string; amount: string }[];
  dailyHours: { date: string; workedSeconds: number }[];
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);

  summary(from: string, to: string) {
    return this.http.get<DashboardSummary>(`${this.apiUrl}/dashboard/summary`, {
      withCredentials: true,
      params: { from, to, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone },
    });
  }
}
