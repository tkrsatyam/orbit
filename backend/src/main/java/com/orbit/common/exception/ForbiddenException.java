package com.orbit.common.exception;

/**
 * Thrown when an authenticated user attempts an action for which they lack authorization,
 * such as non-admins attempting administrative group actions.
 */
public class ForbiddenException extends RuntimeException {

    public ForbiddenException(String message) {
        super(message);
    }
}
