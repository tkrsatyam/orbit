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
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.time.Duration;
import java.time.Instant;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class AuthServiceTest {

    private static final String SECRET =
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    @Mock
    private UserRepository userRepository;

    @Mock
    private RefreshTokenRepository refreshTokenRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private TokenBlacklistService tokenBlacklistService;

    private final OrbitProperties properties = new OrbitProperties(
            new OrbitProperties.Jwt(SECRET, 900_000L, 604_800_000L),
            new OrbitProperties.Cors("http://localhost:4200"),
            new OrbitProperties.Cookie(true, "None"));
    private final JwtService jwtService = new JwtService(properties);

    private AuthService authService;

    @BeforeEach
    void setUp() {
        authService = new AuthService(userRepository, refreshTokenRepository, jwtService, passwordEncoder, tokenBlacklistService, properties);
    }

    private void stubSuccessfulRotation() {
        when(refreshTokenRepository.rotate(anyString(), anyString(), any(Instant.class)))
                .thenAnswer(invocation -> Optional.of(RefreshToken.builder()
                        .userId("user-1")
                        .token(invocation.getArgument(1))
                        .expiresAt(invocation.getArgument(2))
                        .build()));
    }

    @Test
    void registerCreatesUserHashesPasswordAndReturnsTokensWithUser() {
        when(userRepository.existsByEmail("satyam@example.com")).thenReturn(false);
        when(passwordEncoder.encode("StrongP@ss1")).thenReturn("hashed-pwd");

        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            u.setId("generated-user-id");
            return u;
        });

        RegisterRequest request = new RegisterRequest("satyam@example.com", "StrongP@ss1", "Satyam");
        AuthTokens tokens = authService.register(request);

        assertThat(tokens.accessToken()).isNotBlank();
        assertThat(tokens.refreshToken()).hasSize(43);
        assertThat(tokens.user()).isNotNull();
        assertThat(tokens.user().getId()).isEqualTo("generated-user-id");
        assertThat(tokens.user().getEmail()).isEqualTo("satyam@example.com");
        assertThat(tokens.user().getDisplayName()).isEqualTo("Satyam");
        assertThat(tokens.user().getRole()).isEqualTo(UserRole.USER);

        ArgumentCaptor<RefreshToken> sessionCaptor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(sessionCaptor.capture());
        assertThat(sessionCaptor.getValue().getUserId()).isEqualTo("generated-user-id");
        assertThat(sessionCaptor.getValue().getToken()).isEqualTo(tokens.refreshToken());
    }

    @Test
    void registerRejectsDuplicateEmailWithConflictException() {
        when(userRepository.existsByEmail("duplicate@example.com")).thenReturn(true);

        RegisterRequest request = new RegisterRequest("duplicate@example.com", "StrongP@ss1", "Satyam");

        assertThatThrownBy(() -> authService.register(request))
                .isInstanceOf(ConflictException.class)
                .hasMessage("Email is already registered");

        verify(userRepository, never()).save(any());
        verifyNoInteractions(refreshTokenRepository);
    }

    @Test
    void registerNormalizesEmailToLowercase() {
        when(userRepository.existsByEmail("test@example.com")).thenReturn(false);
        when(passwordEncoder.encode(anyString())).thenReturn("hashed-pwd");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> {
            User u = invocation.getArgument(0);
            u.setId("user-id-123");
            return u;
        });

        RegisterRequest request = new RegisterRequest("  TEST@Example.COM  ", "StrongP@ss1", "Tester");
        AuthTokens tokens = authService.register(request);

        assertThat(tokens.user().getEmail()).isEqualTo("test@example.com");
    }

    @Test
    void loginWithValidCredentialsReturnsTokensWithUser() {
        User user = User.builder()
                .id("user-42")
                .email("satyam@example.com")
                .passwordHash("hashed-secret")
                .displayName("Satyam")
                .build();

        when(userRepository.findByEmail("satyam@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("StrongP@ss1", "hashed-secret")).thenReturn(true);

        LoginRequest request = new LoginRequest("satyam@example.com", "StrongP@ss1");
        AuthTokens tokens = authService.login(request);

        assertThat(tokens.accessToken()).isNotBlank();
        assertThat(tokens.refreshToken()).hasSize(43);
        assertThat(tokens.user()).isNotNull();
        assertThat(tokens.user().getId()).isEqualTo("user-42");

        ArgumentCaptor<RefreshToken> sessionCaptor = ArgumentCaptor.forClass(RefreshToken.class);
        verify(refreshTokenRepository).save(sessionCaptor.capture());
        assertThat(sessionCaptor.getValue().getUserId()).isEqualTo("user-42");
    }

    @Test
    void loginWithUnknownEmailThrowsInvalidCredentialsException() {
        when(userRepository.findByEmail("unknown@example.com")).thenReturn(Optional.empty());

        LoginRequest request = new LoginRequest("unknown@example.com", "Password123!");

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(InvalidCredentialsException.class)
                .hasMessage("Invalid email or password");

        verifyNoInteractions(refreshTokenRepository);
    }

    @Test
    void loginWithWrongPasswordThrowsInvalidCredentialsException() {
        User user = User.builder()
                .id("user-42")
                .email("satyam@example.com")
                .passwordHash("correct-hash")
                .build();

        when(userRepository.findByEmail("satyam@example.com")).thenReturn(Optional.of(user));
        when(passwordEncoder.matches("WrongPassword", "correct-hash")).thenReturn(false);

        LoginRequest request = new LoginRequest("satyam@example.com", "WrongPassword");

        assertThatThrownBy(() -> authService.login(request))
                .isInstanceOf(InvalidCredentialsException.class)
                .hasMessage("Invalid email or password");

        verifyNoInteractions(refreshTokenRepository);
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

    @Test
    void logoutBlacklistsAccessTokenDeletesRefreshTokenAndMarksUserOffline() {
        User user = User.builder()
                .id("user-101")
                .email("satyam@example.com")
                .online(true)
                .build();

        when(userRepository.findById("user-101")).thenReturn(Optional.of(user));

        Instant expiresAt = Instant.now().plusSeconds(900);
        authService.logout("user-101", "jti-123", expiresAt, "refresh-token-xyz");

        verify(tokenBlacklistService).blacklist("jti-123", expiresAt);
        verify(refreshTokenRepository).deleteByToken("refresh-token-xyz");

        ArgumentCaptor<User> userCaptor = ArgumentCaptor.forClass(User.class);
        verify(userRepository).save(userCaptor.capture());
        User savedUser = userCaptor.getValue();
        assertThat(savedUser.isOnline()).isFalse();
        assertThat(savedUser.getLastSeen()).isNotNull();
    }

    @Test
    void logoutWithoutRefreshTokenStillBlacklistsTokenAndMarksUserOffline() {
        User user = User.builder()
                .id("user-101")
                .online(true)
                .build();

        when(userRepository.findById("user-101")).thenReturn(Optional.of(user));

        Instant expiresAt = Instant.now().plusSeconds(900);
        authService.logout("user-101", "jti-123", expiresAt, null);

        verify(tokenBlacklistService).blacklist("jti-123", expiresAt);
        verify(refreshTokenRepository, never()).deleteByToken(anyString());
        verify(userRepository).save(user);
        assertThat(user.isOnline()).isFalse();
    }

    @Test
    void logoutWhenUserNotFoundInRepositoryGracefullyCompletes() {
        when(userRepository.findById("unknown-user")).thenReturn(Optional.empty());

        Instant expiresAt = Instant.now().plusSeconds(900);
        authService.logout("unknown-user", "jti-999", expiresAt, "refresh-abc");

        verify(tokenBlacklistService).blacklist("jti-999", expiresAt);
        verify(refreshTokenRepository).deleteByToken("refresh-abc");
        verify(userRepository, never()).save(any());
    }
}