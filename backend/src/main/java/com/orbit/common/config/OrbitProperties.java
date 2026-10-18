package com.orbit.common.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;
import org.springframework.validation.annotation.Validated;

/**
 * Typed binding for every custom property under the orbit.* namespace.
 * No @Value annotations anywhere else in the codebase.
 */
@Validated
@ConfigurationProperties(prefix = "orbit")
public record OrbitProperties(
        @Valid @NotNull Jwt jwt,
        @Valid @NotNull Cors cors,
        @Valid @NotNull Cookie cookie,
        @Valid RateLimit rateLimit) {

    public OrbitProperties {
        if (rateLimit == null) {
            rateLimit = new RateLimit(10, 60, 10, 20, 100);
        }
    }

    public OrbitProperties(Jwt jwt, Cors cors, Cookie cookie) {
        this(jwt, cors, cookie, new RateLimit(10, 60, 10, 20, 100));
    }

    public record Jwt(
            // HS256 needs at least 256 bits; a 64-char hex string from `openssl rand -hex 32` passes
            @NotBlank @Size(min = 32) String secret,
            @Positive long accessTokenExpiryMs,
            @Positive long refreshTokenExpiryMs) {
    }

    public record Cors(
            // Exact frontend origin. Never "*": credentialed requests reject wildcards.
            @NotBlank String allowedOrigin) {
    }

    /** Attributes of the refresh token cookie. */
    public record Cookie(
            boolean secure,
            @NotBlank @Pattern(regexp = "(?i)none|lax|strict") String sameSite) {

        public Cookie {
            if ("none".equalsIgnoreCase(sameSite) && !secure) {
                throw new IllegalArgumentException(
                        "orbit.cookie.same-site=None requires orbit.cookie.secure=true "
                                + "(browsers reject SameSite=None cookies that are not Secure)");
            }
        }
    }

    public record RateLimit(
            @DefaultValue("10") @Positive int authPerMinute,
            @DefaultValue("60") @Positive int messagesPerMinute,
            @DefaultValue("10") @Positive int uploadsPerMinute,
            @DefaultValue("20") @Positive int aiRequestsPerMinute,
            @DefaultValue("100") @Positive int defaultPerMinute) {
    }
}