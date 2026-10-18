package com.orbit.auth;

/** The result of issuing or rotating a session. Both values are credentials, so toString hides them. */
public record AuthTokens(String accessToken, String refreshToken) {

    @Override
    public String toString() {
        return "AuthTokens[redacted]";
    }
}