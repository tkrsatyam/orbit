package com.orbit.auth;

import com.orbit.auth.model.RefreshToken;
import com.orbit.common.config.OrbitProperties;
import com.orbit.common.exception.InvalidRefreshTokenException;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;

@Service
public class AuthService {

    private static final int REFRESH_TOKEN_BYTES = 32;

    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;
    private final OrbitProperties properties;
    private final SecureRandom secureRandom = new SecureRandom();

    public AuthService(RefreshTokenRepository refreshTokenRepository,
                       JwtService jwtService,
                       OrbitProperties properties) {
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtService = jwtService;
        this.properties = properties;
    }

    /**
     * Rotates the session identified by the presented refresh token and issues a new access token.
     *
     * @throws InvalidRefreshTokenException if the token is missing, unknown, expired or already rotated
     */
    public AuthTokens refresh(String presentedRefreshToken) {
        if (presentedRefreshToken == null || presentedRefreshToken.isBlank()) {
            throw new InvalidRefreshTokenException();
        }

        String newRefreshToken = generateRefreshTokenValue();
        Instant newExpiry = Instant.now().plusMillis(properties.jwt().refreshTokenExpiryMs());

        RefreshToken session = refreshTokenRepository
                .rotate(presentedRefreshToken, newRefreshToken, newExpiry)
                .orElseThrow(InvalidRefreshTokenException::new);

        return new AuthTokens(jwtService.generateAccessToken(session.getUserId()), session.getToken());
    }

    /** 32 random bytes, Base64URL without padding (43 characters). Opaque: carries no information. */
    private String generateRefreshTokenValue() {
        byte[] bytes = new byte[REFRESH_TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}