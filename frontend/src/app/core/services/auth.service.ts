import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, map, Observable, of, shareReplay, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { parseJwt } from '../../shared/utils/token-utils';
import { AuthResponse, LoginPayload, RegisterPayload, User } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private static readonly USER_STORAGE_KEY = 'orbit_user';

  private readonly http = inject(HttpClient);

  private readonly accessTokenSignal = signal<string | null>(null);
  private readonly currentUserSignal = signal<User | null>(null);
  private readonly isLoadingSignal = signal<boolean>(true);

  readonly accessToken = this.accessTokenSignal.asReadonly();
  readonly currentUser = this.currentUserSignal.asReadonly();
  readonly isLoading = this.isLoadingSignal.asReadonly();

  readonly isAuthenticated = computed(() => !!this.accessTokenSignal() && !!this.currentUserSignal());

  private refreshObservable$: Observable<AuthResponse> | null = null;

  /**
   * Initializes the authentication session by attempting to refresh the token via httpOnly cookie.
   * Safe for app initialization - never throws, resolves boolean.
   */
  init(): Observable<boolean> {
    return this.refresh().pipe(
      map(() => true),
      catchError(() => {
        this.isLoadingSignal.set(false);
        return of(false);
      })
    );
  }

  /**
   * Refreshes the access token using the backend httpOnly cookie.
   * Deduplicates concurrent calls via shareReplay(1).
   */
  refresh(): Observable<AuthResponse> {
    if (this.refreshObservable$) {
      return this.refreshObservable$;
    }

    this.refreshObservable$ = this.http
      .post<AuthResponse>(`${environment.apiBaseUrl}/api/v1/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        tap((response) => {
          this.handleAuthSuccess(response);
        }),
        catchError((error) => {
          this.handleAuthFailure();
          return throwError(() => error);
        }),
        finalize(() => {
          this.refreshObservable$ = null;
          this.isLoadingSignal.set(false);
        }),
        shareReplay(1)
      );

    return this.refreshObservable$;
  }

  /**
   * Authenticates user with email and password.
   */
  login(credentials: LoginPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiBaseUrl}/api/v1/auth/login`, credentials, {
        withCredentials: true
      })
      .pipe(
        tap((response) => {
          this.handleAuthSuccess(response);
        })
      );
  }

  /**
   * Registers a new user account.
   */
  register(payload: RegisterPayload): Observable<AuthResponse> {
    return this.http
      .post<AuthResponse>(`${environment.apiBaseUrl}/api/v1/auth/register`, payload, {
        withCredentials: true
      })
      .pipe(
        tap((response) => {
          this.handleAuthSuccess(response);
        })
      );
  }

  /**
   * Terminates current session, invalidates cookies on backend, and clears local state.
   */
  logout(): Observable<void> {
    return this.http
      .post<void>(`${environment.apiBaseUrl}/api/v1/auth/logout`, {}, { withCredentials: true })
      .pipe(
        finalize(() => {
          this.handleAuthFailure();
        })
      );
  }

  private handleAuthSuccess(response: AuthResponse): void {
    this.accessTokenSignal.set(response.accessToken);

    if (response.user) {
      this.currentUserSignal.set(response.user);
      this.persistUser(response.user);
      return;
    }

    // On token refresh, backend may omit user object. Restore from localStorage or construct from JWT claims.
    const claims = parseJwt(response.accessToken);
    const cachedUser = this.getCachedUser();

    if (cachedUser && claims && cachedUser.id === claims.sub) {
      this.currentUserSignal.set(cachedUser);
    } else if (claims) {
      const fallbackUser: User = {
        id: claims.sub,
        email: (claims['email'] as string) || cachedUser?.email || '',
        displayName: (claims['displayName'] as string) || cachedUser?.displayName || 'Orbit User'
      };
      this.currentUserSignal.set(fallbackUser);
      this.persistUser(fallbackUser);
    }
  }

  private handleAuthFailure(): void {
    this.accessTokenSignal.set(null);
    this.currentUserSignal.set(null);
    try {
      localStorage.removeItem(AuthService.USER_STORAGE_KEY);
    } catch {
      // Storage unavailable in restricted sandbox
    }
  }

  private persistUser(user: User): void {
    try {
      localStorage.setItem(AuthService.USER_STORAGE_KEY, JSON.stringify(user));
    } catch {
      // Storage unavailable
    }
  }

  private getCachedUser(): User | null {
    try {
      const raw = localStorage.getItem(AuthService.USER_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as User) : null;
    } catch {
      return null;
    }
  }
}
