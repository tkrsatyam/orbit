package com.orbit.common.exception;

/**
 * Thrown when a cookie-based request originates from an origin other than the configured frontend.
 */
public class InvalidOriginException extends RuntimeException {

    public InvalidOriginException() {
        super("Request origin is not allowed");
    }
}