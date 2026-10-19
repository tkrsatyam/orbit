# Frontend Project Structure

This document defines the folder layout, standalone component architecture, naming conventions, and reactive state management patterns for the Orbit Angular SPA. It is the implementation-level reference for building the frontend across all four phases.

Angular 21 enforces structured, enterprise-grade architecture out of the box — this document provides the deliberate decisions that prevent structural drift as the project grows across phases.

---

## Technology Stack Reference

- **Angular 21** — UI framework with standalone components and fine-grained Signals
- **Angular CDK** — component development kit with official virtual scrolling (`CdkVirtualScrollViewport`)
- **Angular Router** — client-side routing with functional guards (`CanActivateFn`)
- **Angular HttpClient** — HTTP client with functional interceptors (`HttpInterceptorFn`) and RxJS pipelines
- **SockJS + STOMP.js** — WebSocket client integrated with RxJS Observables
- **Angular Signals + RxJS** — hybrid reactive state management (Signals for state/UI, RxJS for event streams)
- **Playwright** — automated end-to-end browser testing

---

## Top-Level Project Layout

```
frontend/
├── src/
│   ├── index.html
│   ├── main.ts                     ← application bootstrap with appConfig
│   ├── styles.scss                 ← global styles, CSS variables, and theme tokens
│   └── app/
│       ├── app.component.ts        ← root shell with <router-outlet />
│       ├── app.config.ts           ← provideRouter, provideHttpClient, provideAnimations
│       ├── app.routes.ts           ← route definitions and functional guards
│       │
│       ├── core/                   ← singleton services, interceptors, guards, models
│       │   ├── guards/
│       │   │   └── auth.guard.ts   ← functional CanActivateFn redirecting to /login
│       │   ├── interceptors/
│       │   │   └── auth.interceptor.ts ← attaches JWT, withCredentials, 401 refresh queue
│       │   ├── models/
│       │   │   ├── auth.model.ts   ← User, AuthResponse, LoginPayload, RegisterPayload
│       │   │   ├── message.model.ts
│       │   │   └── conversation.model.ts
│       │   └── services/
│       │       ├── auth.service.ts ← in-memory signals state, login, register, refresh, logout
│       │       ├── websocket.service.ts ← SockJS + STOMP singleton with RxJS streams
│       │       ├── conversation.service.ts
│       │       └── user.service.ts
│       │
│       ├── features/               ← route-level feature pages and feature-specific components
│       │   ├── auth/
│       │   │   ├── auth.component.ts
│       │   │   ├── login-form/
│       │   │   └── register-form/
│       │   ├── conversations/
│       │   │   ├── conversations.component.ts
│       │   │   ├── conversation-list/
│       │   │   ├── message-thread/
│       │   │   └── message-input/
│       │   ├── discover/
│       │   │   └── discover.component.ts
│       │   └── group/
│       │       └── group.component.ts
│       │
│       └── shared/                 ← reusable UI primitives, pipes, and directives
│           ├── components/
│           │   ├── self-profile-modal/ ← authenticated user profile dialog (ORDM-89)
│           │   ├── button/
│           │   ├── modal/
│           │   ├── spinner/
│           │   └── avatar/
│           ├── pipes/
│           │   └── time-ago.pipe.ts
│           └── utils/
│               └── token-utils.ts  ← parseJwt, parseJwtExpiry, isTokenExpired
│
├── e2e/                            ← Playwright browser end-to-end test suite
│   └── auth.spec.ts
├── angular.json                    ← Angular CLI configuration (port 4200)
├── package.json
├── playwright.config.ts
└── tsconfig.json
```

---

## Core Layer Responsibilities (`src/app/core/`)

The `core/` folder houses application-wide singletons. Modules and components never instantiate services directly — Angular's dependency injection (`inject()`) provides singletons:

1. **`auth.service.ts`**:
   - Manages in-memory JWT authentication state using Angular Signals:
     - `currentUser = signal<User | null>(null)`
     - `accessToken = signal<string | null>(null)`
     - `isLoading = signal<boolean>(true)`
     - `isAuthenticated = computed(() => !!this.accessToken() && !!this.currentUser())`
   - Bootstraps user session on startup by executing `refresh()`.
   - Hydrates user profile on refresh via `GET /api/v1/users/me`, keeping profile data server-authoritative and completely in-memory.
   - In-flight refresh deduplication using RxJS `shareReplay(1)`.

2. **`auth.interceptor.ts`**:
   - Functional interceptor (`HttpInterceptorFn`).
   - Automatically attaches `Authorization: Bearer <accessToken>` from `AuthService` if present.
   - Enforces `withCredentials: true` on backend requests so the browser includes httpOnly cookies.
   - Catches HTTP 401 errors, queues concurrent requests behind `authService.refresh()`, and replays failed calls upon successful token issuance.

3. **`auth.guard.ts`**:
   - Functional guard (`CanActivateFn`).
   - Checks `authService.isLoading()`. If bootstrapping, waits until authentication state settles.
   - Checks `authService.isAuthenticated()`. If unauthenticated, navigates to `/login` with `queryParams: { returnUrl: state.url }`.

4. **`websocket.service.ts`**:
   - Singleton managing SockJS + STOMP connection lifetime.
   - Exposes RxJS `Subject` and `Observable` streams for topics (`/topic/conversations/{id}/messages`, `/topic/presence/{contactId}`).
   - Handles automatic reconnection and STOMP disconnect on application unload.

---

## Routing Structure (`src/app/app.routes.ts`)

```typescript
import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/auth/auth.component').then(m => m.AuthComponent),
    data: { mode: 'login' }
  },
  {
    path: 'register',
    loadComponent: () => import('./features/auth/auth.component').then(m => m.AuthComponent),
    data: { mode: 'register' }
  },
  {
    path: 'discover',
    loadComponent: () => import('./features/discover/discover.component').then(m => m.DiscoverComponent)
  },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      {
        path: '',
        loadComponent: () => import('./features/conversations/conversations.component').then(m => m.ConversationsComponent)
      },
      {
        path: 'groups/:id',
        loadComponent: () => import('./features/group/group.component').then(m => m.GroupComponent)
      }
    ]
  },
  {
    path: '**',
    loadComponent: () => import('./features/not-found/not-found.component').then(m => m.NotFoundComponent)
  }
];
```

---

## State Management Strategy (Signals + RxJS)

Orbit utilizes a deliberate hybrid state pattern:

| State Type | Mechanism | Justification |
|---|---|---|
| **Auth State** (`currentUser`, `accessToken`) | Signals in `AuthService` | Fine-grained template binding without full component tree re-renders. |
| **Real-Time WebSocket Streams** | RxJS `Observable` in `WebSocketService` | Operators (`filter`, `debounceTime`, `distinctUntilChanged`) handle async streams. |
| **Active Conversation Messages** | Signal with Angular CDK Virtual Scroll | Pinpoint DOM updates with high-performance scroll anchoring for large chat logs. |
| **Form Inputs & Validation** | Reactive Forms (`FormGroup`) | Robust synchronous/asynchronous validation, dirty/touched states. |
| **Typing Indicators** | RxJS `Subject` with `debounceTime(3000)` | Automatic auto-clear and event emission throttling. |
| **Presence Map** | Signal derived from RxJS presence topic | Efficient dictionary mapping user IDs to online status. |

---

## JWT Token Storage Rules

- **Access tokens are strictly in memory only** inside `AuthService`'s `accessToken` signal. Never store tokens in `localStorage` or `sessionStorage`.
- **Refresh tokens** reside exclusively in httpOnly, Secure, SameSite cookies set by the backend server.
- On browser reload, the in-memory access token is cleared. `AuthService` executes `refresh()` on initialization. The browser includes the httpOnly cookie, issuing a new access token transparently.

---

## Environment & Server Configuration

Development server runs on standard Angular default port `4200`:
```json
// angular.json
"serve": {
  "options": {
    "port": 4200
  }
}
```
Proxy configuration or environment files supply `apiBaseUrl: 'http://localhost:8080'` and `wsUrl: 'http://localhost:8080/ws'`.
