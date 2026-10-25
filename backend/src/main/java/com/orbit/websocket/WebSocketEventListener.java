package com.orbit.websocket;

import com.orbit.presence.PresenceService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.event.EventListener;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;

/**
 * Listens for Spring STOMP session lifecycle events and maintains the multi-tab session registry.
 * Dispatches online/offline transitions to PresenceService only on first session connect / last session disconnect.
 */
@Component
public class WebSocketEventListener {

    private static final Logger log = LoggerFactory.getLogger(WebSocketEventListener.class);

    private final WebSocketSessionRegistry sessionRegistry;
    private final PresenceService presenceService;

    public WebSocketEventListener(WebSocketSessionRegistry sessionRegistry,
                                  PresenceService presenceService) {
        this.sessionRegistry = sessionRegistry;
        this.presenceService = presenceService;
    }

    @EventListener
    public void handleSessionConnected(SessionConnectedEvent event) {
        SimpMessageHeaderAccessor headerAccessor = SimpMessageHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();
        Principal user = headerAccessor.getUser();

        if (user != null && sessionId != null) {
            String userId = user.getName();
            boolean isFirstSession = sessionRegistry.registerSession(userId, sessionId);
            log.info("WebSocket connected: userId={}, sessionId={}, firstSession={}", userId, sessionId, isFirstSession);
            if (isFirstSession) {
                presenceService.handleConnect(userId);
            }
        }
    }

    @EventListener
    public void handleSessionDisconnect(SessionDisconnectEvent event) {
        SimpMessageHeaderAccessor headerAccessor = SimpMessageHeaderAccessor.wrap(event.getMessage());
        String sessionId = headerAccessor.getSessionId();

        if (sessionId != null) {
            String userId = sessionRegistry.getUserIdForSession(sessionId);
            boolean isLastSession = sessionRegistry.unregisterSession(sessionId);
            log.info("WebSocket disconnected: userId={}, sessionId={}, lastSession={}", userId, sessionId, isLastSession);
            if (isLastSession && userId != null) {
                presenceService.handleDisconnect(userId);
            }
        }
    }
}
