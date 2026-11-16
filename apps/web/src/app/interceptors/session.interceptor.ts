import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject, Injector } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_URL } from '../api.config';
import { AuthService } from '../services/auth.service';

export const sessionInterceptor: HttpInterceptorFn = (request, next) => {
  const apiUrl = inject(API_URL).replace(/\/$/, '');
  const injector = inject(Injector);
  return next(request).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        request.url.startsWith(`${apiUrl}/`) &&
        request.url.split('?')[0] !== `${apiUrl}/auth/me`
      ) {
        injector.get(AuthService).clearSession();
        void injector.get(Router).navigateByUrl('/login');
      }
      return throwError(() => error);
    }),
  );
};
