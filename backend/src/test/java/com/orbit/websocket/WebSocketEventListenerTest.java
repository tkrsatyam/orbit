package com.orbit.websocket;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.messaging.Message;
import org.springframework.messaging.simp.SimpMessageHeaderAccessor;
import org.springframework.messaging.support.MessageBuilder;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.messaging.SessionConnectedEvent;
import org.springframework.web.socket.messaging.SessionDisconnectEvent;

import java.security.Principal;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WebSocketEventListenerTest {

    @Mock
    private WebSocketSessionRegistry sessionRegistry;

    private WebSocketEventListener eventListener;

    @BeforeEach
    void setUp() {
        eventListener = new WebSocketEventListener(sessionRegistry);
    }

    @Test
    @DisplayName("handleSessionConnected registers session when user principal is present")
    void handleSessionConnected_registersSession() {
        SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create();
        accessor.setSessionId("sess-100");
        Principal principal = new StompPrincipal("user-100");
        accessor.setUser(principal);

        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
        SessionConnectedEvent event = new SessionConnectedEvent(this, message, principal);

        eventListener.handleSessionConnected(event);

        verify(sessionRegistry).registerSession("user-100", "sess-100");
    }

    @Test
    @DisplayName("handleSessionDisconnect unregisters session")
    void handleSessionDisconnect_unregistersSession() {
        SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create();
        accessor.setSessionId("sess-100");

        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
        SessionDisconnectEvent event = new SessionDisconnectEvent(this, message, "sess-100", CloseStatus.NORMAL);

        when(sessionRegistry.getUserIdForSession("sess-100")).thenReturn("user-100");
        when(sessionRegistry.unregisterSession("sess-100")).thenReturn(true);

        eventListener.handleSessionDisconnect(event);

        verify(sessionRegistry).getUserIdForSession("sess-100");
        verify(sessionRegistry).unregisterSession("sess-100");
    }
}
