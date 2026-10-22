package com.orbit.websocket;

import com.orbit.auth.token.AccessTokenClaims;
import com.orbit.auth.token.JwtService;
import com.orbit.auth.token.TokenBlacklistService;
import com.orbit.common.exception.InvalidTokenException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.WebSocketHandler;
import org.springframework.web.socket.server.HandshakeInterceptor;

import java.net.URI;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Map;

/**
 * Handshake interceptor validating the JWT access token passed via the ?token= query parameter
 * on the initial HTTP upgrade request (wss://.../ws?token=...).
 *
 * <p>Authentication is performed once during connection establishment. The session remains trusted
 * for its full lifetime regardless of the access token's 15-minute expiry.
 */
@Component
public class StompHandshakeInterceptor implements HandshakeInterceptor {

    private static final Logger log = LoggerFactory.getLogger(StompHandshakeInterceptor.class);

    public static final String ATTR_USER_ID = "userId";
    public static final String ATTR_TOKEN_ID = "tokenId";

    private final JwtService jwtService;
    private final TokenBlacklistService tokenBlacklistService;

    public StompHandshakeInterceptor(JwtService jwtService, TokenBlacklistService tokenBlacklistService) {
        this.jwtService = jwtService;
        this.tokenBlacklistService = tokenBlacklistService;
    }

    @Override
    public boolean beforeHandshake(ServerHttpRequest request,
                                   ServerHttpResponse response,
                                   WebSocketHandler wsHandler,
                                   Map<String, Object> attributes) {
        String token = extractToken(request);
        if (token == null || token.isBlank()) {
            log.warn("WebSocket handshake rejected: missing token parameter from {}", request.getRemoteAddress());
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }

        try {
            AccessTokenClaims claims = jwtService.validateToken(token);
            if (tokenBlacklistService.isBlackListed(claims.tokenId())) {
                log.warn("WebSocket handshake rejected: revoked token (tokenId={})", claims.tokenId());
                response.setStatusCode(HttpStatus.UNAUTHORIZED);
                return false;
            }

            attributes.put(ATTR_USER_ID, claims.userId());
            attributes.put(ATTR_TOKEN_ID, claims.tokenId());
            return true;
        } catch (InvalidTokenException e) {
            log.warn("WebSocket handshake rejected: invalid token ({})", e.getMessage());
            response.setStatusCode(HttpStatus.UNAUTHORIZED);
            return false;
        }
    }

    @Override
    public void afterHandshake(ServerHttpRequest request,
                               ServerHttpResponse response,
                               WebSocketHandler wsHandler,
                               Exception exception) {
        // No-op
    }

    private String extractToken(ServerHttpRequest request) {
        URI uri = request.getURI();
        String query = uri.getRawQuery();
        if (query == null || query.isBlank()) {
            return null;
        }
        for (String param : query.split("&")) {
            String[] pair = param.split("=", 2);
            if (pair.length == 2 && "token".equals(pair[0])) {
                return URLDecoder.decode(pair[1], StandardCharsets.UTF_8);
            }
        }
        return null;
    }
}
