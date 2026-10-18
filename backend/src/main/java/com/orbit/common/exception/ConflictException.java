package com.orbit.common.exception;

/**
 * Thrown when an operation conflicts with current state, such as duplicate unique fields.
 */
public class ConflictException extends RuntimeException {

    public ConflictException(String message) {
        super(message);
    }
}
