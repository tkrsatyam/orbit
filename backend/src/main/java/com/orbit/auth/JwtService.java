package com.orbit.auth;

import com.orbit.common.config.OrbitProperties;
import com.orbit.common.exception.InvalidTokenException;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Date;
import java.util.UUID;

/**
 * The single class that creates and parses JWTs. No other class imports the JWT library.
 */
@Service
public class JwtService {
    
    private final SecretKey signingKey;
    private final long accessTokenExpiryMs;
    
    public JwtService(OrbitProperties properties) {
        this.signingKey = Keys.hmacShaKeyFor(properties.jwt().secret().getBytes(StandardCharsets.UTF_8));
        this.accessTokenExpiryMs = properties.jwt().accessTokenExpiryMs();
    }

    /** Creates a signed access token whose subject is the user's id. */
    public String generateAccessToken(String userId) {
        Instant now = Instant.now();
        return Jwts.builder()
                .subject(userId)
                .id(UUID.randomUUID().toString())
                .issuedAt(Date.from(now))
                .expiration(Date.from(now.plusMillis(accessTokenExpiryMs)))
                .signWith(signingKey, Jwts.SIG.HS256)
                .compact();
    }

    /**
     * Verifies signature and expiry, then returns the token's claims.
     * 
     * @throws com.orbit.common.exception.InvalidTokenException if the token is malformed, tampered with or expired
     */
    public AccessTokenClaims parseAccessToken(String token) {
        try {
            Claims claims = Jwts.parser()
                    .verifyWith(signingKey)
                    .build()
                    .parseSignedClaims(token)
                    .getPayload();
            return new AccessTokenClaims(
                    claims.getSubject(),
                    claims.getId(), 
                    claims.getExpiration().toInstant());
        } catch (JwtException | IllegalArgumentException e) {
            throw new InvalidTokenException("Invalid or expired access token", e);
        }
    }
}
