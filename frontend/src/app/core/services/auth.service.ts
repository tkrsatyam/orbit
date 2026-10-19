import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { catchError, finalize, map, Observable, of, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginPayload, RegisterPayload, User } from '../models/auth.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
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
   * Refreshes the access token using the backend httpOnly cookie,
   * then hydrates currentUser by calling GET /api/v1/users/me.
   * Deduplicates concurrent calls via shareReplay(1).
   */
  refresh(): Observable<AuthResponse> {
    if (this.refreshObservable$) {
      return this.refreshObservable$;
    }

    this.refreshObservable$ = this.http
      .post<AuthResponse>(`${environment.apiBaseUrl}/api/v1/auth/refresh`, {}, { withCredentials: true })
      .pipe(
        switchMap((authResponse) => {
          this.accessTokenSignal.set(authResponse.accessToken);
          return this.getSelfProfile(authResponse.accessToken).pipe(
            map((user) => ({
              accessToken: authResponse.accessToken,
              user
            }))
          );
        }),
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
   * Fetches the authenticated user profile from GET /api/v1/users/me.
   */
  getSelfProfile(token?: string): Observable<User> {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    return this.http.get<User>(`${environment.apiBaseUrl}/api/v1/users/me`, {
      headers,
      withCredentials: true
    });
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
    }
  }

  private handleAuthFailure(): void {
    this.accessTokenSignal.set(null);
    this.currentUserSignal.set(null);
  }
}
