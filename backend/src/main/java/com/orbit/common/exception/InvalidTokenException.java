package com.orbit.common.exception;

/** Thrown when an access token fails signature, format or expiry checks. */
public class InvalidTokenException extends RuntimeException {
    
    public InvalidTokenException(String message, Throwable cause) {
        super(message, cause);
    }
}
