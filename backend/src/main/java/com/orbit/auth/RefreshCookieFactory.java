package com.orbit.auth;

import com.orbit.common.config.OrbitProperties;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;

import java.time.Duration;

/** Builds the refresh token cookie. Attributes come from orbit.cookie.* so deployments can change them by configuration. */
@Component
public class RefreshCookieFactory {

    public static final String COOKIE_NAME = "refreshToken";
    private static final String COOKIE_PATH = "/api/v1/auth";

    private final OrbitProperties.Cookie settings;
    private final Duration maxAge;

    public RefreshCookieFactory(OrbitProperties properties) {
        this.settings = properties.cookie();
        this.maxAge = Duration.ofMillis(properties.jwt().refreshTokenExpiryMs());
    }

    public ResponseCookie create(String refreshToken) {
        return ResponseCookie.from(COOKIE_NAME, refreshToken)
                .httpOnly(true)
                .secure(settings.secure())
                .sameSite(settings.sameSite())
                .path(COOKIE_PATH)
                .maxAge(maxAge)
                .build();
    }
}