package com.orbit.auth;

import java.time.Instant;

/**
 * The verified contents of an access token, in plain Java types so that
 * nothing outside JwtService needs to know about the JWT library.
 */
public record AccessTokenClaims(String userId, String tokenId, Instant expiresAt) {
}
