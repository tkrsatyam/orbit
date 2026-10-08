package com.orbit.auth.filter;

import com.orbit.auth.AccessTokenClaims;
import com.orbit.auth.JwtService;
import com.orbit.auth.TokenBlacklistService;
import com.orbit.common.exception.InvalidTokenException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.List;

/**
 * Validates the access token once per request (signature, expiry, blacklist) and
 * populates the SecurityContext. Nothing downstream re-validates.
 *
 * <p>This filter never rejects a request itself. A missing or invalid token simply
 * leaves the request unauthenticated, and the authorization rules in SecurityConfig
 * decide whether the endpoint is public or answers 401.
 *
 * <p>Deliberately not a @Component: it is created in SecurityConfig so that Spring Boot
 * does not also register it a second time as a plain servlet filter.
 */
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    
    private static final String BEARER_PREFIX = "Bearer ";
    
    private final JwtService jwtService;
    private final TokenBlacklistService tokenBlacklistService;
    
    public JwtAuthenticationFilter(JwtService jwtService, TokenBlacklistService tokenBlacklistService) {
        this.jwtService = jwtService;
        this.tokenBlacklistService = tokenBlacklistService;
    }
    
    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String token = extractBearerToken(request);
        if (token != null) {
            authenticate(token);
        }
        filterChain.doFilter(request, response);
    }

    private void authenticate(String token) {
        try {
            AccessTokenClaims claims = jwtService.parseAccessToken(token);
            if (tokenBlacklistService.isBlackListed(claims.tokenId())) {
                return;
            }
            UsernamePasswordAuthenticationToken authentication = 
                    UsernamePasswordAuthenticationToken.authenticated(claims.userId(), null, List.of());
            authentication.setDetails(claims);

            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(authentication);
            SecurityContextHolder.setContext(context);
        } catch (InvalidTokenException e) {
            // Leave the request unauthenticated; protected endpoints will answer 401.
        }
    }

    private String extractBearerToken(HttpServletRequest request) {
        String header = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (header == null || !header.startsWith(BEARER_PREFIX)) {
            return null;
        }
        String token = header.substring(BEARER_PREFIX.length()).trim();
        return token.isEmpty() ? null : token;
    }
}
