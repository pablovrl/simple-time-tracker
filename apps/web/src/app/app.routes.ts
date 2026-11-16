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
    path: '',
    canActivate: [sessionGuard],
    canActivateChild: [sessionGuard],
    loadComponent: () => import('./components/layout/layout').then((module) => module.Layout),
    children: [
      {
        path: 'entries',
        title: 'Entries',
        loadComponent: () => import('./pages/entries/entries').then((module) => module.Entries),
      },
      {
        path: 'dashboard',
        title: 'Dashboard',
        loadComponent: () =>
          import('./pages/dashboard/dashboard').then((module) => module.Dashboard),
      },
      {
        path: 'projects',
        title: 'Projects',
        loadComponent: () => import('./pages/projects/projects').then((module) => module.Projects),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
