package com.orbit.auth;

import com.orbit.auth.dto.LoginRequest;
import com.orbit.auth.dto.RegisterRequest;
import com.orbit.auth.model.RefreshToken;
import com.orbit.auth.token.JwtService;
import com.orbit.auth.token.RefreshTokenRepository;
import com.orbit.auth.token.TokenBlacklistService;
import com.orbit.common.config.OrbitProperties;
import com.orbit.common.exception.ConflictException;
import com.orbit.common.exception.InvalidCredentialsException;
import com.orbit.common.exception.InvalidRefreshTokenException;
import com.orbit.user.UserRepository;
import com.orbit.user.model.User;
import com.orbit.user.model.UserRole;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Instant;
import java.util.Base64;

@Service
public class AuthService {

    private static final int REFRESH_TOKEN_BYTES = 32;

    private final UserRepository userRepository;
    private final RefreshTokenRepository refreshTokenRepository;
    private final JwtService jwtService;
    private final PasswordEncoder passwordEncoder;
    private final TokenBlacklistService tokenBlacklistService;
    private final OrbitProperties properties;
    private final SecureRandom secureRandom = new SecureRandom();

    public AuthService(UserRepository userRepository,
                       RefreshTokenRepository refreshTokenRepository,
                       JwtService jwtService,
                       PasswordEncoder passwordEncoder,
                       TokenBlacklistService tokenBlacklistService,
                       OrbitProperties properties) {
        this.userRepository = userRepository;
        this.refreshTokenRepository = refreshTokenRepository;
        this.jwtService = jwtService;
        this.passwordEncoder = passwordEncoder;
        this.tokenBlacklistService = tokenBlacklistService;
        this.properties = properties;
    }

    /**
     * Registers a new user account, creates a refresh token session, and returns auth tokens with the user.
     *
     * @throws ConflictException if email is already registered
     */
    public AuthTokens register(RegisterRequest request) {
        String normalizedEmail = request.email().trim().toLowerCase();
        if (userRepository.existsByEmail(normalizedEmail)) {
            throw new ConflictException("Email is already registered");
        }

        Instant now = Instant.now();
        User user = User.builder()
                .email(normalizedEmail)
                .passwordHash(passwordEncoder.encode(request.password()))
                .displayName(request.displayName().trim())
                .role(UserRole.USER)
                .online(false)
                .createdAt(now)
                .updatedAt(now)
                .build();

        User savedUser = userRepository.save(user);

        return issueSession(savedUser);
    }

    /**
     * Authenticates an existing user with email and password, creates a refresh session, and returns auth tokens.
     *
     * @throws InvalidCredentialsException if credentials are invalid
     */
    public AuthTokens login(LoginRequest request) {
        String normalizedEmail = request.email().trim().toLowerCase();
        User user = userRepository.findByEmail(normalizedEmail)
                .orElseThrow(InvalidCredentialsException::new);

        if (!passwordEncoder.matches(request.password(), user.getPasswordHash())) {
            throw new InvalidCredentialsException();
        }

        return issueSession(user);
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

    /**
     * Invalidates the active session: blacklists the current access token, deletes
     * the refresh token session from the database, and marks the user offline with lastSeen.
     */
    public void logout(String userId, String tokenId, Instant expiresAt, String refreshToken) {
        if (tokenId != null && expiresAt != null) {
            tokenBlacklistService.blacklist(tokenId, expiresAt);
        }

        if (refreshToken != null && !refreshToken.isBlank()) {
            refreshTokenRepository.deleteByToken(refreshToken);
        }

        if (userId != null && !userId.isBlank()) {
            userRepository.findById(userId).ifPresent(user -> {
                user.setOnline(false);
                user.setLastSeen(Instant.now());
                userRepository.save(user);
            });
        }
    }

    private AuthTokens issueSession(User user) {
        String accessToken = jwtService.generateAccessToken(user.getId());
        String refreshToken = generateRefreshTokenValue();
        Instant expiry = Instant.now().plusMillis(properties.jwt().refreshTokenExpiryMs());

        RefreshToken session = RefreshToken.builder()
                .userId(user.getId())
                .token(refreshToken)
                .expiresAt(expiry)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();

        refreshTokenRepository.save(session);

        return new AuthTokens(accessToken, refreshToken, user);
    }

    /** 32 random bytes, Base64URL without padding (43 characters). Opaque: carries no information. */
    private String generateRefreshTokenValue() {
        byte[] bytes = new byte[REFRESH_TOKEN_BYTES];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}