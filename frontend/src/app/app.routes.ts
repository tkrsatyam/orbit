import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/auth.component').then((m) => m.AuthComponent),
    data: { mode: 'login' }
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/auth.component').then((m) => m.AuthComponent),
    data: { mode: 'register' }
  },
  {
    path: 'discover',
    loadComponent: () => import('./features/discover/discover.component').then((m) => m.DiscoverComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/conversations/conversations.component').then((m) => m.ConversationsComponent)
      },
      {
        path: 'groups/:id',
        loadComponent: () => import('./features/group/group.component').then((m) => m.GroupComponent)
      }
    ]
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent)
  }
];
