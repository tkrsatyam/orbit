package com.orbit.common.ratelimit;

import java.time.Instant;

/**
 * Thread-safe token bucket implementation for rate limiting.
 */
public class TokenBucket {

    private final double capacity;
    private final double refillTokensPerMinute;
    private double tokens;
    private long lastRefillTimestampMs;
    private Instant lastAccessedAt;

    public TokenBucket(int limitPerMinute, long nowMs) {
        this.capacity = limitPerMinute;
        this.refillTokensPerMinute = limitPerMinute;
        this.tokens = limitPerMinute;
        this.lastRefillTimestampMs = nowMs;
        this.lastAccessedAt = Instant.ofEpochMilli(nowMs);
    }

    public synchronized ConsumptionResult tryConsume(long nowMs) {
        this.lastAccessedAt = Instant.ofEpochMilli(nowMs);
        long elapsedMs = Math.max(0, nowMs - lastRefillTimestampMs);

        if (elapsedMs > 0) {
            double tokensToAdd = (elapsedMs * refillTokensPerMinute) / 60000.0;
            this.tokens = Math.min(capacity, this.tokens + tokensToAdd);
            this.lastRefillTimestampMs = nowMs;
        }

        if (this.tokens >= 1.0) {
            this.tokens -= 1.0;
            return ConsumptionResult.success();
        }

        double missingTokens = 1.0 - this.tokens;
        double msNeeded = (missingTokens * 60000.0) / refillTokensPerMinute;
        long retryAfterSeconds = Math.max(1, (long) Math.ceil(msNeeded / 1000.0));
        return ConsumptionResult.rejected(retryAfterSeconds);
    }

    public synchronized boolean isStale(long nowMs, long staleThresholdMs) {
        return (nowMs - lastAccessedAt.toEpochMilli()) >= staleThresholdMs;
    }

    public synchronized double getTokens() {
        return tokens;
    }
}
