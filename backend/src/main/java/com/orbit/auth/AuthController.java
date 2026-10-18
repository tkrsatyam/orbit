package com.orbit.auth;

import com.orbit.auth.dto.AuthResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final OriginVerifier originVerifier;
    private final RefreshCookieFactory refreshCookieFactory;

    public AuthController(AuthService authService,
                          OriginVerifier originVerifier,
                          RefreshCookieFactory refreshCookieFactory) {
        this.authService = authService;
        this.originVerifier = originVerifier;
        this.refreshCookieFactory = refreshCookieFactory;
    }

    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(
            @CookieValue(name = RefreshCookieFactory.COOKIE_NAME, required = false) String refreshToken,
            @RequestHeader(name = HttpHeaders.ORIGIN, required = false) String origin) {

        originVerifier.verify(origin);
        AuthTokens tokens = authService.refresh(refreshToken);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookieFactory.create(tokens.refreshToken()).toString())
                .body(new AuthResponse(tokens.accessToken()));
    }
}