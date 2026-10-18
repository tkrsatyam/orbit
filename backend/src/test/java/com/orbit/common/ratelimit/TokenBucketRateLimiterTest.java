package com.orbit.common.ratelimit;

import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneId;

import static org.assertj.core.api.Assertions.assertThat;

class TokenBucketRateLimiterTest {

    @Test
    void isolatesDifferentKeys() {
        TokenBucketRateLimiter limiter = new TokenBucketRateLimiter();

        // Exhaust key-A
        for (int i = 0; i < 2; i++) {
            assertThat(limiter.tryConsume("key-A", 2).allowed()).isTrue();
        }
        assertThat(limiter.tryConsume("key-A", 2).allowed()).isFalse();

        // key-B has independent capacity
        assertThat(limiter.tryConsume("key-B", 2).allowed()).isTrue();
        assertThat(limiter.size()).isEqualTo(2);
    }

    @Test
    void purgesStaleBuckets() {
        Clock fixedClock = Clock.fixed(Instant.ofEpochMilli(1_000_000L), ZoneId.of("UTC"));
        TokenBucketRateLimiter limiter = new TokenBucketRateLimiter(fixedClock);

        limiter.tryConsume("key-1", 10);
        assertThat(limiter.size()).isEqualTo(1);

        // Not stale with 10s threshold
        limiter.purgeStaleBuckets(10_000L);
        assertThat(limiter.size()).isEqualTo(1);

        // Advance clock by 20s
        Clock laterClock = Clock.fixed(Instant.ofEpochMilli(1_020_000L), ZoneId.of("UTC"));
        TokenBucketRateLimiter laterLimiter = new TokenBucketRateLimiter(laterClock);
        laterLimiter.tryConsume("key-1", 10); // created at 1_000_000 in reality, but for laterLimiter:
        laterLimiter.purgeStaleBuckets(10_000L); // last accessed at 1_020_000, not stale

        limiter.purgeStaleBuckets(0L); // stale with 0ms threshold
        assertThat(limiter.size()).isZero();
    }
}
