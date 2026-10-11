package com.orbit.common.exception;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.ResponseStatus;

/** A cookie-based request came from an origin other than the configured frontend. Interim @ResponseStatus until ORDM-30. */
@ResponseStatus(HttpStatus.FORBIDDEN)
public class InvalidOriginException extends RuntimeException {

    public InvalidOriginException() {
        super("Request origin is not allowed");
    }
}