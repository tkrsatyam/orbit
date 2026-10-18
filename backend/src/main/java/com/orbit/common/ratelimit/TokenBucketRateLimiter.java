package com.orbit.common.ratelimit;

import org.springframework.stereotype.Component;

import java.time.Clock;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/**
 * In-memory registry of TokenBuckets.
 */
@Component
public class TokenBucketRateLimiter {

    private static final long DEFAULT_STALE_THRESHOLD_MS = 10 * 60 * 1000L; // 10 minutes

    private final Map<String, TokenBucket> buckets = new ConcurrentHashMap<>();
    private final Clock clock;

    public TokenBucketRateLimiter() {
        this(Clock.systemUTC());
    }

    public TokenBucketRateLimiter(Clock clock) {
        this.clock = clock;
    }

    public ConsumptionResult tryConsume(String key, int limitPerMinute) {
        long now = clock.millis();
        TokenBucket bucket = buckets.computeIfAbsent(key, k -> new TokenBucket(limitPerMinute, now));
        return bucket.tryConsume(now);
    }

    public void purgeStaleBuckets() {
        purgeStaleBuckets(DEFAULT_STALE_THRESHOLD_MS);
    }

    public void purgeStaleBuckets(long staleThresholdMs) {
        long now = clock.millis();
        buckets.entrySet().removeIf(entry -> entry.getValue().isStale(now, staleThresholdMs));
    }

    public int size() {
        return buckets.size();
    }

    public void reset() {
        buckets.clear();
    }
}
