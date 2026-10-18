package com.orbit.common.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

/**
 * Standard error response envelope matching API_CONTRACTS.md.
 */
@Schema(description = "Standard API error response envelope")
public record ErrorResponse(
        @Schema(description = "HTTP status code", example = "400")
        int status,

        @Schema(description = "HTTP status reason phrase", example = "Bad Request")
        String error,

        @Schema(description = "Descriptive error message", example = "Display name must be between 2 and 50 characters")
        String message,

        @Schema(description = "Request URI path", example = "/api/v1/users/me")
        String path,

        @Schema(description = "ISO-8601 UTC timestamp of the error", example = "2026-10-18T17:15:00Z")
        Instant timestamp) {

    public static ErrorResponse of(int status, String error, String message, String path) {
        return new ErrorResponse(status, error, message, path, Instant.now());
    }
}
