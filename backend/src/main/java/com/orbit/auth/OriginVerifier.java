package com.orbit.auth;

import com.orbit.common.config.OrbitProperties;
import com.orbit.common.exception.InvalidOriginException;
import org.springframework.stereotype.Component;

/** Defence in depth against CSRF on cookie-based endpoints: rejects a foreign Origin header. */
@Component
public class OriginVerifier {

    private final String allowedOrigin;

    public OriginVerifier(OrbitProperties properties) {
        String origin = properties.cors().allowedOrigin();
        this.allowedOrigin = origin.endsWith("/") ? origin.substring(0, origin.length() - 1) : origin;
    }

    /** @throws InvalidOriginException if an Origin header is present and is not the configured frontend origin */
    public void verify(String originHeader) {
        if (originHeader != null && !allowedOrigin.equalsIgnoreCase(originHeader)) {
            throw new InvalidOriginException();
        }
    }
}