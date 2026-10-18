package com.orbit.common.ratelimit;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TokenBucketTest {

    @Test
    void allowsConsumptionUpToCapacity() {
        long start = 1_000_000L;
        TokenBucket bucket = new TokenBucket(5, start);

        for (int i = 0; i < 5; i++) {
            ConsumptionResult result = bucket.tryConsume(start);
            assertThat(result.allowed()).isTrue();
            assertThat(result.retryAfterSeconds()).isZero();
        }

        // 6th consumption immediately fails
        ConsumptionResult exceeded = bucket.tryConsume(start);
        assertThat(exceeded.allowed()).isFalse();
        assertThat(exceeded.retryAfterSeconds()).isGreaterThan(0);
    }

    @Test
    void refillsTokensOverTime() {
        long start = 1_000_000L;
        TokenBucket bucket = new TokenBucket(60, start); // 60 tokens per minute = 1 token per second

        // Exhaust all 60 tokens
        for (int i = 0; i < 60; i++) {
            assertThat(bucket.tryConsume(start).allowed()).isTrue();
        }
        assertThat(bucket.tryConsume(start).allowed()).isFalse();

        // Advance by 2 seconds -> should refill 2 tokens
        long twoSecondsLater = start + 2000L;
        assertThat(bucket.tryConsume(twoSecondsLater).allowed()).isTrue();
        assertThat(bucket.tryConsume(twoSecondsLater).allowed()).isTrue();
        assertThat(bucket.tryConsume(twoSecondsLater).allowed()).isFalse();
    }

    @Test
    void doesNotExceedCapacityAfterLongInactivity() {
        long start = 1_000_000L;
        TokenBucket bucket = new TokenBucket(10, start);

        // Advance 10 hours
        long muchLater = start + 36_000_000L;
        // Should only be able to consume 10 tokens, not more
        for (int i = 0; i < 10; i++) {
            assertThat(bucket.tryConsume(muchLater).allowed()).isTrue();
        }
        assertThat(bucket.tryConsume(muchLater).allowed()).isFalse();
    }

    @Test
    void identifiesStaleBucket() {
        long start = 1_000_000L;
        TokenBucket bucket = new TokenBucket(10, start);

        assertThat(bucket.isStale(start + 5000L, 10_000L)).isFalse();
        assertThat(bucket.isStale(start + 15_000L, 10_000L)).isTrue();
    }
}
