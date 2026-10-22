package com.orbit.websocket;

import com.orbit.auth.token.AccessTokenClaims;
import com.orbit.auth.token.JwtService;
import com.orbit.auth.token.TokenBlacklistService;
import com.orbit.common.exception.InvalidTokenException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.socket.WebSocketHandler;

import java.net.URI;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class StompHandshakeInterceptorTest {

    @Mock
    private JwtService jwtService;

    @Mock
    private TokenBlacklistService tokenBlacklistService;

    @Mock
    private ServerHttpRequest request;

    @Mock
    private ServerHttpResponse response;

    @Mock
    private WebSocketHandler wsHandler;

    private StompHandshakeInterceptor interceptor;

    @BeforeEach
    void setUp() {
        interceptor = new StompHandshakeInterceptor(jwtService, tokenBlacklistService);
    }

    @Test
    @DisplayName("Handshake succeeds and populates attributes when valid token is present")
    void beforeHandshake_validToken_succeeds() {
        String token = "valid-jwt-token";
        URI uri = URI.create("wss://api.orbit.com/ws?token=" + token);
        when(request.getURI()).thenReturn(uri);

        AccessTokenClaims claims = new AccessTokenClaims("user-123", "token-uuid", Instant.now().plusSeconds(900));
        when(jwtService.validateToken(token)).thenReturn(claims);
        when(tokenBlacklistService.isBlackListed("token-uuid")).thenReturn(false);

        Map<String, Object> attributes = new HashMap<>();
        boolean result = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(result).isTrue();
        assertThat(attributes.get(StompHandshakeInterceptor.ATTR_USER_ID)).isEqualTo("user-123");
        assertThat(attributes.get(StompHandshakeInterceptor.ATTR_TOKEN_ID)).isEqualTo("token-uuid");
        verifyNoInteractions(response);
    }

    @Test
    @DisplayName("Handshake fails with 401 when token query param is missing")
    void beforeHandshake_missingToken_rejectsWith401() {
        URI uri = URI.create("wss://api.orbit.com/ws");
        when(request.getURI()).thenReturn(uri);

        Map<String, Object> attributes = new HashMap<>();
        boolean result = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(result).isFalse();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
        assertThat(attributes).isEmpty();
        verifyNoInteractions(jwtService);
    }

    @Test
    @DisplayName("Handshake fails with 401 when token query param is empty")
    void beforeHandshake_emptyToken_rejectsWith401() {
        URI uri = URI.create("wss://api.orbit.com/ws?token=");
        when(request.getURI()).thenReturn(uri);

        Map<String, Object> attributes = new HashMap<>();
        boolean result = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(result).isFalse();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
        assertThat(attributes).isEmpty();
        verifyNoInteractions(jwtService);
    }

    @Test
    @DisplayName("Handshake fails with 401 when token is invalid or expired")
    void beforeHandshake_invalidToken_rejectsWith401() {
        String token = "expired-token";
        URI uri = URI.create("wss://api.orbit.com/ws?token=" + token);
        when(request.getURI()).thenReturn(uri);
        when(jwtService.validateToken(token)).thenThrow(new InvalidTokenException("Token expired", new RuntimeException("Expired")));

        Map<String, Object> attributes = new HashMap<>();
        boolean result = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(result).isFalse();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
        assertThat(attributes).isEmpty();
    }

    @Test
    @DisplayName("Handshake fails with 401 when token has been blacklisted")
    void beforeHandshake_blacklistedToken_rejectsWith401() {
        String token = "revoked-token";
        URI uri = URI.create("wss://api.orbit.com/ws?token=" + token);
        when(request.getURI()).thenReturn(uri);

        AccessTokenClaims claims = new AccessTokenClaims("user-123", "revoked-uuid", Instant.now().plusSeconds(900));
        when(jwtService.validateToken(token)).thenReturn(claims);
        when(tokenBlacklistService.isBlackListed("revoked-uuid")).thenReturn(true);

        Map<String, Object> attributes = new HashMap<>();
        boolean result = interceptor.beforeHandshake(request, response, wsHandler, attributes);

        assertThat(result).isFalse();
        verify(response).setStatusCode(HttpStatus.UNAUTHORIZED);
        assertThat(attributes).isEmpty();
    }
}
