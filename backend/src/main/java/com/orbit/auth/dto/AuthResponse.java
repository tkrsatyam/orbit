package com.orbit.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;

/**
 * Body of POST /api/v1/auth/refresh. A nullable `user` is added with register and login (ORDM-26).
 */
@Schema(description = "Authentication response containing the JWT access token")
public record AuthResponse(
        @Schema(description = "JWT access token used for Bearer authentication", example = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...")
        String accessToken) {
}