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
    loadComponent: () =>
      import('./features/conversations/conversations.component').then((m) => m.ConversationsComponent),
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./features/conversations/welcome-canvas/welcome-canvas.component').then(
            (m) => m.WelcomeCanvasComponent
          )
      },
      {
        path: 'groups/:id',
        loadComponent: () => import('./features/group/group.component').then((m) => m.GroupComponent)
      },
      {
        path: 'invite/:token',
        loadComponent: () => import('./features/invite-join/invite-join.component').then((m) => m.InviteJoinComponent)
      }
    ]
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.component').then((m) => m.NotFoundComponent)
  }
];
