package com.orbit.auth;

import com.orbit.common.config.OrbitProperties;
import com.orbit.common.exception.InvalidTokenException;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Base64;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class JwtServiceTest {
    
    private static final String SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    private static final String OTHER_SECRET = "fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210";
    private static final long FIFTEEN_MINUTES_MS = 900_000L;
    
    private final JwtService jwtService = serviceWith(SECRET, FIFTEEN_MINUTES_MS);
    
    private static JwtService serviceWith(String secret, long accessTokenExpiryMs) {
        OrbitProperties properties = new OrbitProperties(
                new OrbitProperties.Jwt(secret, accessTokenExpiryMs, 604_800_000L),
                new OrbitProperties.Cors("http://localhost:5173"));
        return new JwtService(properties);
    }
    
    private static String base64Url(String json) {
        return Base64.getUrlEncoder().withoutPadding().encodeToString(json.getBytes(StandardCharsets.UTF_8));
    }
    
    @Test
    void generatedTokenParsesBackToTheSameUser() {
        String token = jwtService.generateAccessToken("user-1");
        
        AccessTokenClaims claims = jwtService.parseAccessToken(token);
        
        assertThat(claims.userId()).isEqualTo("user-1");
        assertThat(claims.tokenId()).isNotBlank();
        assertThat(claims.expiresAt()).isAfter(Instant.now());
    }
    
    @Test
    void eachTokenGetsItsOwnId() {
        AccessTokenClaims first = jwtService.parseAccessToken(jwtService.generateAccessToken("user-1"));
        AccessTokenClaims second = jwtService.parseAccessToken(jwtService.generateAccessToken("user-1"));
        
        assertThat(first.tokenId()).isNotEqualTo(second.tokenId());
    }
    
    @Test
    void expiredTokenIsRejected() {
        JwtService alreadyExpired = serviceWith(SECRET, -1_000L);
        String token = alreadyExpired.generateAccessToken("user-1");
        
        assertThatThrownBy(() -> jwtService.parseAccessToken(token)).isInstanceOf(InvalidTokenException.class);
    }
    
    @Test
    void tokenSignedWithAnotherSecretIsRejected() {
        String token = serviceWith(OTHER_SECRET, FIFTEEN_MINUTES_MS).generateAccessToken("user-1");
        
        assertThatThrownBy(() -> jwtService.parseAccessToken(token)).isInstanceOf(InvalidTokenException.class);
    }
    
    @Test
    void tokenWithSwappedPayloadIsRejected() {
        String[] original = jwtService.generateAccessToken("user-1").split("\\.");
        String[] other = jwtService.generateAccessToken("user-2").split("\\.");

        // header and signature from user-1's token, payload from user-2's token:
        // the signature no longer matches the payload, so verification must fail
        String forged = original[0] + "." + other[1] + "." + original[2];
        
        assertThatThrownBy(() -> jwtService.parseAccessToken(forged)).isInstanceOf(InvalidTokenException.class);
    }
    
    @Test
    void unsignedTokenWithAlgNoneIsRejected() {
        String unsigned = base64Url("{\"alg\":\"none\"}") + "."
                + base64Url("{\"sub\":\"user-1\",\"exp\":4102444800}") + ".";
        
        assertThatThrownBy(() -> jwtService.parseAccessToken(unsigned)).isInstanceOf(InvalidTokenException.class);
    }
    
    @Test
    void garbageIsRejected() {
        assertThatThrownBy(() -> jwtService.parseAccessToken("not-a-jwt")).isInstanceOf(InvalidTokenException.class);
    }
}
