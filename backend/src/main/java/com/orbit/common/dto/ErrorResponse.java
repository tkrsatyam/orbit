package com.orbit.common.dto;

import java.time.Instant;

/**
 * Standard error response envelope matching API_CONTRACTS.md.
 */
public record ErrorResponse(
        int status,
        String error,
        String message,
        String path,
        Instant timestamp) {

    public static ErrorResponse of(int status, String error, String message, String path) {
        return new ErrorResponse(status, error, message, path, Instant.now());
    }
}
