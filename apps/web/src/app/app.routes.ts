import { Routes } from '@angular/router';
import { guestGuard, sessionGuard } from './guards/auth.guards';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login').then((module) => module.Login),
  },
  {
    path: 'dashboard',
    canActivate: [sessionGuard],
    title: 'Dashboard',
    loadComponent: () => import('./pages/dashboard/dashboard').then((module) => module.Dashboard),
  },
  { path: '**', redirectTo: 'dashboard' },
];
