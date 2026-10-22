package com.orbit.websocket;

import java.security.Principal;
import java.util.Objects;

/**
 * Principal representing an authenticated user in the STOMP message broker.
 * The principal name corresponds to the user's ID.
 */
public record StompPrincipal(String name) implements Principal {

    public StompPrincipal {
        Objects.requireNonNull(name, "Principal name cannot be null");
    }

    @Override
    public String getName() {
        return name;
    }
}
