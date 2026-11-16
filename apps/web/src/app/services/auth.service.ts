import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { API_URL } from '../api.config';
import { Router } from '@angular/router';
import { catchError, finalize, Observable, of, shareReplay, tap } from 'rxjs';

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
  private checked = false;
  private pending?: Observable<{ user: User } | null>;

  ensureSession() {
    if (this.pending) return this.pending;
    return this.checked ? of(this.user() ? { user: this.user()! } : null) : this.loadUser();
  }

  loadUser() {
    if (this.pending) return this.pending;
    this.loading.set(true);
    this.error.set(null);
    this.pending = this.http
      .get<{ user: User }>(`${this.apiUrl}/auth/me`, { withCredentials: true })
      .pipe(
        tap(({ user }) => {
          this.user.set(user);
          this.checked = true;
        }),
        catchError((error: HttpErrorResponse) => {
          this.user.set(null);
          this.checked = error.status === 401;
          if (error.status !== 401) {
            this.error.set('Unable to reach your account. Please try again.');
          }
          return of(null);
        }),
        finalize(() => {
          this.loading.set(false);
          this.pending = undefined;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
    return this.pending;
  }

  clearSession() {
    this.user.set(null);
    this.checked = true;
    this.error.set(null);
    this.loading.set(false);
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
    this.clearSession();
    this.loggingOut.set(false);
    void this.router.navigateByUrl('/login');
  }
}
