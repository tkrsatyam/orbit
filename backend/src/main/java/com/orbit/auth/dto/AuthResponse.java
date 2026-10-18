package com.orbit.auth.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Authentication response containing JWT access token and user profile summary.
 * Returned on register, login, and refresh. The user property is omitted on refresh.
 */
@Schema(description = "Authentication response containing the JWT access token and optional user profile summary")
@JsonInclude(JsonInclude.Include.NON_NULL)
public record AuthResponse(
        @Schema(description = "JWT access token used for Bearer authentication", example = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")
        String accessToken,

        @Schema(description = "User profile summary (null on token refresh)", nullable = true)
        UserSummaryResponse user) {

    public AuthResponse(String accessToken) {
        this(accessToken, null);
    }
}