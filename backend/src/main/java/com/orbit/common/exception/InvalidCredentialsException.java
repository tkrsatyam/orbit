package com.orbit.common.exception;

/**
 * Thrown when login fails due to unknown email or invalid password.
 */
public class InvalidCredentialsException extends RuntimeException {

    public InvalidCredentialsException() {
        super("Invalid email or password");
    }

    public InvalidCredentialsException(String message) {
        super(message);
    }
}
