import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { API_URL } from '../api.config';
import { Router } from '@angular/router';
import { catchError, finalize, of, tap } from 'rxjs';

export interface User {
  id: string;
  name: string;
  email: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = inject(API_URL);
  private readonly router = inject(Router);
  readonly loginUrl = `${this.apiUrl}/auth/google`;
  readonly user = signal<User | null>(null);
  readonly loading = signal(true);
  readonly loggingOut = signal(false);
  readonly error = signal<string | null>(null);

  loadUser() {
    this.loading.set(true);
    this.error.set(null);
    return this.http.get<{ user: User }>(`${this.apiUrl}/auth/me`, { withCredentials: true }).pipe(
      tap(({ user }) => {
        this.user.set(user);
      }),
      catchError((error: HttpErrorResponse) => {
        this.user.set(null);
        if (error.status !== 401) {
          this.error.set('Unable to reach your account. Please try again.');
        }
        return of(null);
      }),
      finalize(() => this.loading.set(false)),
    );
  }

  logout() {
    if (this.loggingOut()) return;
    this.loggingOut.set(true);
    this.error.set(null);
    this.http.post(`${this.apiUrl}/auth/logout`, {}, { withCredentials: true }).subscribe({
      next: () => this.finishLogout(),
      error: (error: HttpErrorResponse) => {
        if (error.status === 401) {
          this.finishLogout();
        } else {
          this.error.set('Unable to sign out. Please try again.');
          this.loggingOut.set(false);
        }
      },
    });
  }

  private finishLogout() {
    this.user.set(null);
    this.loggingOut.set(false);
    void this.router.navigateByUrl('/login');
  }
}
