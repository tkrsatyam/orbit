package com.orbit.auth;

import com.orbit.auth.model.RefreshToken;
import com.orbit.auth.token.JwtService;
import com.orbit.auth.token.RefreshTokenRepository;
import com.orbit.common.config.OrbitProperties;
import com.orbit.common.exception.InvalidRefreshTokenException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final String SECRET =
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    private final OrbitProperties properties = new OrbitProperties(
            new OrbitProperties.Jwt(SECRET, 900_000L, 604_800_000L),
            new OrbitProperties.Cors("http://localhost:5173"),
            new OrbitProperties.Cookie(true, "None"));
    private final JwtService jwtService = new JwtService(properties);

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(refreshTokenRepository, jwtService, properties);
    }

    /** Makes the fake repository behave like a successful rotation of a session owned by user-1. */
    private void stubSuccessfulRotation() {
        when(refreshTokenRepository.rotate(anyString(), anyString(), any(Instant.class)))
                .thenAnswer(invocation -> Optional.of(RefreshToken.builder()
                        .userId("user-1")
                        .token(invocation.getArgument(1))
                        .expiresAt(invocation.getArgument(2))
                        .build()));
    }

    @Test
    void refreshRotatesTheSessionAndIssuesNewTokens() {
        stubSuccessfulRotation();

        AuthTokens tokens = authService.refresh("old-token");

        assertThat(jwtService.validateToken(tokens.accessToken()).userId()).isEqualTo("user-1");
        assertThat(tokens.refreshToken()).isNotEqualTo("old-token").hasSize(43);
    }

    @Test
    void everyRotationUsesAFreshRandomValue() {
        stubSuccessfulRotation();

        String first = authService.refresh("token-a").refreshToken();
        String second = authService.refresh("token-b").refreshToken();

        assertThat(first).isNotEqualTo(second);
    }

    @Test
    void newRefreshTokenExpiresAfterTheConfiguredLifetime() {
        stubSuccessfulRotation();
        ArgumentCaptor<Instant> expiry = ArgumentCaptor.forClass(Instant.class);

        authService.refresh("old-token");

        verify(refreshTokenRepository).rotate(eq("old-token"), anyString(), expiry.capture());
        Instant expected = Instant.now().plus(Duration.ofDays(7));
        assertThat(expiry.getValue()).isBetween(expected.minusSeconds(5), expected.plusSeconds(5));
    }

    @Test
    void refreshRejectsATokenThatIsUnknownExpiredOrAlreadyRotated() {
        when(refreshTokenRepository.rotate(anyString(), anyString(), any(Instant.class)))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> authService.refresh("stale-token"))
                .isInstanceOf(InvalidRefreshTokenException.class);
    }

    @Test
    void refreshRejectsAMissingCookieWithoutTouchingTheDatabase() {
        assertThatThrownBy(() -> authService.refresh(null))
                .isInstanceOf(InvalidRefreshTokenException.class);
        assertThatThrownBy(() -> authService.refresh("   "))
                .isInstanceOf(InvalidRefreshTokenException.class);

        verifyNoInteractions(refreshTokenRepository);
    }
}