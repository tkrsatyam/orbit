package com.orbit.websocket;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.web.socket.WebSocketHandler;

import java.security.Principal;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

@ExtendWith(MockitoExtension.class)
class CustomHandshakeHandlerTest {

    @Mock
    private ServerHttpRequest request;

    @Mock
    private WebSocketHandler wsHandler;

    private CustomHandshakeHandler handshakeHandler;

    @BeforeEach
    void setUp() {
        handshakeHandler = new CustomHandshakeHandler();
    }

    @Test
    @DisplayName("determineUser resolves StompPrincipal when userId attribute is present")
    void determineUser_withUserIdAttribute_returnsStompPrincipal() {
        Map<String, Object> attributes = new HashMap<>();
        attributes.put(StompHandshakeInterceptor.ATTR_USER_ID, "user-456");

        Principal principal = handshakeHandler.determineUser(request, wsHandler, attributes);

        assertThat(principal).isNotNull();
        assertThat(principal).isInstanceOf(StompPrincipal.class);
        assertThat(principal.getName()).isEqualTo("user-456");
    }

    @Test
    @DisplayName("determineUser returns null or super default when userId attribute is absent")
    void determineUser_withoutUserIdAttribute_delegatesToSuper() {
        Map<String, Object> attributes = new HashMap<>();

        Principal principal = handshakeHandler.determineUser(request, wsHandler, attributes);

        assertThat(principal).isNull();
    }
}
