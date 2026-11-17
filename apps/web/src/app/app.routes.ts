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
    canActivate: [sessionGuard],
    canActivateChild: [sessionGuard],
    loadComponent: () => import('./components/layout/layout').then((module) => module.Layout),
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'simple time tracker',
        loadComponent: () => import('./pages/home/home').then((module) => module.Home),
      },
      {
        path: 'entries',
        title: 'entries',
        loadComponent: () => import('./pages/entries/entries').then((module) => module.Entries),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
