package com.orbit.common.ratelimit;

/**
 * Result of a rate limit token consumption attempt.
 */
public record ConsumptionResult(boolean allowed, long retryAfterSeconds) {

    public static ConsumptionResult success() {
        return new ConsumptionResult(true, 0);
    }

    public static ConsumptionResult rejected(long retryAfterSeconds) {
        return new ConsumptionResult(false, retryAfterSeconds);
    }
}
