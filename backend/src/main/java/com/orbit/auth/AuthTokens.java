package com.orbit.auth;

import com.orbit.user.model.User;

/** The result of issuing or rotating a session. Both tokens are credentials, so toString hides them. */
public record AuthTokens(String accessToken, String refreshToken, User user) {

    public AuthTokens(String accessToken, String refreshToken) {
        this(accessToken, refreshToken, null);
    }

    @Override
    public String toString() {
        return "AuthTokens[redacted]";
    }
}