package com.orbit.auth;

import org.junit.jupiter.api.Test;

import java.time.Duration;
import java.time.Instant;

import static org.assertj.core.api.Assertions.assertThat;

class TokenBlacklistServiceTest {
    
    private final TokenBlacklistService blacklist = new TokenBlacklistService();
    
    private static Instant inTheFuture() {
        return Instant.now().plus(Duration.ofMinutes(15));
    }
    
    private static Instant inThePast() {
        return Instant.now().minus(Duration.ofMinutes(1));
    }
    
    @Test
    void blacklistedTokenIsReportedAsBlacklisted() {
        blacklist.blacklist("token-1", inTheFuture());
        
        assertThat(blacklist.isBlackListed("token-1")).isTrue();
    }
    
    @Test
    void unknownTokenIsNotBlacklisted() {
        assertThat(blacklist.isBlackListed("never-seen")).isFalse();
    }
    
    @Test
    void blacklistingOneTokenDoesNotAffectAnother() {
        blacklist.blacklist("token-1", inTheFuture());
        
        assertThat(blacklist.isBlackListed("token-2")).isFalse();
    }
    
    @Test
    void entryIsIgnoredOnceTheTokenHasExpired() {
        blacklist.blacklist("token-1", inThePast());
        
        assertThat(blacklist.isBlackListed("token-1")).isFalse();
    }
    
    @Test
    void expiredEntriesAreRemovedWhenTheNextTokenIsBlacklisted() {
        blacklist.blacklist("old", inThePast());
        blacklist.blacklist("new", inTheFuture());
        
        assertThat(blacklist.size()).isEqualTo(1);
        assertThat(blacklist.isBlackListed("new")).isTrue();
    }
}
