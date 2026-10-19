import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

export const IS_RETRY = new HttpContextToken<boolean>(() => false);

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isAuthEndpoint =
    req.url.includes('/api/v1/auth/login') ||
    req.url.includes('/api/v1/auth/register') ||
    req.url.includes('/api/v1/auth/refresh');

  if (isAuthEndpoint) {
    const authReq = req.clone({ withCredentials: true });
    return next(authReq);
  }

  const token = authService.accessToken();
  let headers = req.headers;
  if (token && !headers.has('Authorization')) {
    headers = headers.set('Authorization', `Bearer ${token}`);
  }

  const authorizedReq = req.clone({
    headers,
    withCredentials: true
  });

  return next(authorizedReq).pipe(
    catchError((error: unknown) => {
      const isLogout = req.url.includes('/api/v1/auth/logout');
      if (
        !isLogout &&
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !req.context.get(IS_RETRY)
      ) {
        return authService.refresh().pipe(
          switchMap((response) => {
            const retryReq = req.clone({
              setHeaders: {
                Authorization: `Bearer ${response.accessToken}`
              },
              withCredentials: true,
              context: req.context.set(IS_RETRY, true)
            });
            return next(retryReq);
          }),
          catchError((refreshError) => {
            const currentUrl = router.url;
            if (currentUrl && !currentUrl.startsWith('/login') && !currentUrl.startsWith('/register')) {
              router.navigate(['/login'], { queryParams: { returnUrl: currentUrl } });
            } else {
              router.navigate(['/login']);
            }
            return throwError(() => refreshError);
          })
        );
      }

      return throwError(() => error);
    })
  );
};
