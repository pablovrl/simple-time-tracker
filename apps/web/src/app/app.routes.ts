import { Routes } from '@angular/router';
import { guestGuard, sessionGuard } from './guards/auth.guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login').then((module) => module.Login),
  },
  {
    path: 'home',
    canActivate: [sessionGuard],
    loadComponent: () => import('./pages/home/home').then((module) => module.Home),
  },
  { path: '**', redirectTo: 'home' },
];
