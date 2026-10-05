package com.orbit.auth;

import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Remembers access tokens that were revoked at logout, so the JWT filter can reject
 * them before their natural expiry. Entries are keyed by the token's jti and only
 * matter until the token expires on its own.
 *
 * <p>In-memory: entries are lost on restart and not shared between instances. The
 * short access token lifetime bounds that exposure. Replaceable by a Redis-backed
 * version later.
 */
@Service
public class TokenBlacklistService {
    
    /** token id (jti) -> instant at which the token expires anyway */
    private final Map<String, Instant> blacklistedUntil = new ConcurrentHashMap<>();
    
    public void blacklist(String tokenId, Instant expiresAt) {
        purgeExpired();
        blacklistedUntil.put(tokenId, expiresAt);
    }
    
    public boolean isBlackListed(String tokenId) {
        Instant expiresAt = blacklistedUntil.get(tokenId);
        return expiresAt != null && expiresAt.isAfter(Instant.now());
    }
    
    /** Visible for testing. */
    int size() {
        return blacklistedUntil.size();
    }

    private void purgeExpired() {
        Instant now = Instant.now();
        blacklistedUntil.values().removeIf(expiresAt -> !expiresAt.isAfter(now));
    }
}
