package com.orbit.websocket;

import com.orbit.presence.PresenceService;
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

    @Mock
    private PresenceService presenceService;

    private WebSocketEventListener eventListener;

    @BeforeEach
    void setUp() {
        eventListener = new WebSocketEventListener(sessionRegistry, presenceService);
    }

    @Test
    @DisplayName("handleSessionConnected registers session and invokes presence on first session")
    void handleSessionConnected_registersSession_andInvokesPresenceOnFirstSession() {
        SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create();
        accessor.setSessionId("sess-100");
        Principal principal = new StompPrincipal("user-100");
        accessor.setUser(principal);

        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
        SessionConnectedEvent event = new SessionConnectedEvent(this, message, principal);

        when(sessionRegistry.registerSession("user-100", "sess-100")).thenReturn(true);

        eventListener.handleSessionConnected(event);

        verify(sessionRegistry).registerSession("user-100", "sess-100");
        verify(presenceService).handleConnect("user-100");
    }

    @Test
    @DisplayName("handleSessionConnected does not invoke presence if not first session")
    void handleSessionConnected_doesNotInvokePresence_ifNotFirstSession() {
        SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create();
        accessor.setSessionId("sess-101");
        Principal principal = new StompPrincipal("user-100");
        accessor.setUser(principal);

        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
        SessionConnectedEvent event = new SessionConnectedEvent(this, message, principal);

        when(sessionRegistry.registerSession("user-100", "sess-101")).thenReturn(false);

        eventListener.handleSessionConnected(event);

        verify(sessionRegistry).registerSession("user-100", "sess-101");
        verify(presenceService, never()).handleConnect(any());
    }

    @Test
    @DisplayName("handleSessionDisconnect unregisters session and invokes presence on last session")
    void handleSessionDisconnect_unregistersSession_andInvokesPresenceOnLastSession() {
        SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create();
        accessor.setSessionId("sess-100");

        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
        SessionDisconnectEvent event = new SessionDisconnectEvent(this, message, "sess-100", CloseStatus.NORMAL);

        when(sessionRegistry.getUserIdForSession("sess-100")).thenReturn("user-100");
        when(sessionRegistry.unregisterSession("sess-100")).thenReturn(true);

        eventListener.handleSessionDisconnect(event);

        verify(sessionRegistry).unregisterSession("sess-100");
        verify(presenceService).handleDisconnect("user-100");
    }

    @Test
    @DisplayName("handleSessionDisconnect does not invoke presence if not last session")
    void handleSessionDisconnect_doesNotInvokePresence_ifNotLastSession() {
        SimpMessageHeaderAccessor accessor = SimpMessageHeaderAccessor.create();
        accessor.setSessionId("sess-100");

        Message<byte[]> message = MessageBuilder.createMessage(new byte[0], accessor.getMessageHeaders());
        SessionDisconnectEvent event = new SessionDisconnectEvent(this, message, "sess-100", CloseStatus.NORMAL);

        when(sessionRegistry.getUserIdForSession("sess-100")).thenReturn("user-100");
        when(sessionRegistry.unregisterSession("sess-100")).thenReturn(false);

        eventListener.handleSessionDisconnect(event);

        verify(sessionRegistry).unregisterSession("sess-100");
        verify(presenceService, never()).handleDisconnect(any());
    }
}
