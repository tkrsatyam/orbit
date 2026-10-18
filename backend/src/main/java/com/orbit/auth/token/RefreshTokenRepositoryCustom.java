package com.orbit.auth.token;

import com.orbit.auth.model.RefreshToken;

import java.time.Instant;
import java.util.Optional;

public interface RefreshTokenRepositoryCustom {

    /**
     * Atomically replaces the token value and expiry of the session identified by
     * {@code presentedToken}, in place. Matches only tokens that have not expired.
     *
     * @return the updated session, or empty if the token is unknown, expired or already rotated
     */
    Optional<RefreshToken> rotate(String presentedToken, String newToken, Instant newExpiresAt);
}