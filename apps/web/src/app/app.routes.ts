import { Routes } from '@angular/router';
import { guestGuard, sessionGuard } from './guards/auth.guards';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login').then((module) => module.Login),
  },
  {
    path: '',
    pathMatch: 'full',
    canActivate: [sessionGuard],
    title: 'simple time tracker',
    loadComponent: () => import('./pages/home/home').then((module) => module.Home),
  },
  { path: '**', redirectTo: '' },
];
