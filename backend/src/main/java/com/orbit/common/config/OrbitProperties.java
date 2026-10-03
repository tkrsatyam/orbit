package com.orbit.common.config;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.validation.annotation.Validated;

@Validated
@ConfigurationProperties(prefix = "orbit")
public record OrbitProperties(
        @Valid @NotNull Jwt jwt,
        @Valid @NotNull Cors cors) {
    
    public record Jwt(
            @NotBlank @Size(min = 32) String secret,
            @Positive long accessTokenExpiryMs,
            @Positive long refreshTokenExpiryMs) {
    }
    
    public record Cors(
    @NotBlank String allowedOrigin) {
    }
}
