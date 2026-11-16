import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { map } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const sessionGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth
    .ensureSession()
    .pipe(map(() => (auth.user() ? true : router.createUrlTree(['/login']))));
};

export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth
    .ensureSession()
    .pipe(map(() => (auth.user() ? router.createUrlTree(['/dashboard']) : true)));
};
