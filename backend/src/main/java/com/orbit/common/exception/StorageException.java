package com.orbit.common.exception;

/**
 * Thrown when an error occurs during object storage operations (e.g. upload, delete, presigning).
 */
public class StorageException extends RuntimeException {

    public StorageException(String message) {
        super(message);
    }

    public StorageException(String message, Throwable cause) {
        super(message, cause);
    }
}
