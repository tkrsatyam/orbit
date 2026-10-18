package com.orbit.common.exception;

/**
 * Thrown when the refresh cookie is missing, unknown, expired, or already rotated.
 */
public class InvalidRefreshTokenException extends RuntimeException {

    public InvalidRefreshTokenException() {
        super("Invalid or expired refresh token");
    }
}