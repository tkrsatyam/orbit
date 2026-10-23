package com.orbit.websocket;

import org.springframework.http.server.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.support.DefaultHandshakeHandler;

import java.security.Principal;
import java.util.Map;

/**
 * Handshake handler that associates an authenticated StompPrincipal with the WebSocket session,
 * allowing user-specific routing (/user/queue/...).
 */
@Component
public class CustomHandshakeHandler extends DefaultHandshakeHandler {

    @Override
    protected Principal determineUser(ServerHttpRequest request,
                                      WebSocketHandler wsHandler,
                                      Map<String, Object> attributes) {
        String userId = (String) attributes.get(StompHandshakeInterceptor.ATTR_USER_ID);
        if (userId != null && !userId.isBlank()) {
            return new StompPrincipal(userId);
        }
        return super.determineUser(request, wsHandler, attributes);
    }
}
