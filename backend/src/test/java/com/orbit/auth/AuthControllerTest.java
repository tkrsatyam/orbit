package com.orbit.auth;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.orbit.auth.dto.AuthResponse;
import com.orbit.auth.dto.LoginRequest;
import com.orbit.auth.dto.RegisterRequest;
import com.orbit.auth.dto.UserSummaryResponse;
import com.orbit.common.config.OrbitProperties;
import com.orbit.common.exception.ConflictException;
import com.orbit.common.exception.GlobalExceptionHandler;
import com.orbit.common.exception.InvalidCredentialsException;
import com.orbit.auth.token.AccessTokenClaims;
import com.orbit.user.model.User;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.time.Instant;
import java.util.List;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@ExtendWith(MockitoExtension.class)
class AuthControllerTest {

    private static final String REGISTER_PATH = "/api/v1/auth/register";
    private static final String LOGIN_PATH = "/api/v1/auth/login";
    private static final String LOGOUT_PATH = "/api/v1/auth/logout";

    @Mock
    private AuthService authService;

    @Mock
    private OriginVerifier originVerifier;

    private final OrbitProperties properties = new OrbitProperties(
            new OrbitProperties.Jwt("secret-key", 900_000L, 604_800_000L),
            new OrbitProperties.Cors("http://localhost:5173"),
            new OrbitProperties.Cookie(true, "None"));

    private final RefreshCookieFactory refreshCookieFactory = new RefreshCookieFactory(properties);
    private final ObjectMapper objectMapper = new ObjectMapper();

    private MockMvc mockMvc;

    @BeforeEach
    void setUp() {
        AuthController authController = new AuthController(authService, originVerifier, refreshCookieFactory);
        mockMvc = MockMvcBuilders.standaloneSetup(authController)
                .setControllerAdvice(new GlobalExceptionHandler())
                .build();
    }

    private User sampleUser() {
        return User.builder()
                .id("user-101")
                .email("satyam@example.com")
                .displayName("Satyam")
                .createdAt(Instant.parse("2026-06-27T10:30:00Z"))
                .build();
    }

    @Test
    void registerWithValidPayloadReturns201AndSetsCookie() throws Exception {
        User user = sampleUser();
        AuthTokens tokens = new AuthTokens("access-token-123", "refresh-token-xyz", user);
        when(authService.register(any(RegisterRequest.class))).thenReturn(tokens);

        RegisterRequest request = new RegisterRequest("satyam@example.com", "StrongP@ss1", "Satyam");

        mockMvc.perform(post(REGISTER_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isCreated())
                .andExpect(header().exists(HttpHeaders.SET_COOKIE))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, org.hamcrest.Matchers.containsString("refreshToken=")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, org.hamcrest.Matchers.containsString("HttpOnly")))
                .andExpect(jsonPath("$.accessToken").value("access-token-123"))
                .andExpect(jsonPath("$.user.id").value("user-101"))
                .andExpect(jsonPath("$.user.email").value("satyam@example.com"))
                .andExpect(jsonPath("$.user.displayName").value("Satyam"));
    }

    @Test
    void registerWithWeakPasswordReturns400() throws Exception {
        RegisterRequest request = new RegisterRequest("satyam@example.com", "weak", "Satyam");

        mockMvc.perform(post(REGISTER_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.error").value("Bad Request"))
                .andExpect(jsonPath("$.message", org.hamcrest.Matchers.containsString("password:")));
    }

    @Test
    void registerWithInvalidEmailReturns400() throws Exception {
        RegisterRequest request = new RegisterRequest("not-an-email", "StrongP@ss1", "Satyam");

        mockMvc.perform(post(REGISTER_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message", org.hamcrest.Matchers.containsString("email:")));
    }

    @Test
    void registerWithShortDisplayNameReturns400() throws Exception {
        RegisterRequest request = new RegisterRequest("satyam@example.com", "StrongP@ss1", "A");

        mockMvc.perform(post(REGISTER_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400))
                .andExpect(jsonPath("$.message", org.hamcrest.Matchers.containsString("displayName:")));
    }

    @Test
    void registerDuplicateEmailReturns409() throws Exception {
        when(authService.register(any(RegisterRequest.class)))
                .thenThrow(new ConflictException("Email is already registered"));

        RegisterRequest request = new RegisterRequest("satyam@example.com", "StrongP@ss1", "Satyam");

        mockMvc.perform(post(REGISTER_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.status").value(409))
                .andExpect(jsonPath("$.error").value("Conflict"))
                .andExpect(jsonPath("$.message").value("Email is already registered"));
    }

    @Test
    void loginWithValidCredentialsReturns200AndSetsCookie() throws Exception {
        User user = sampleUser();
        AuthTokens tokens = new AuthTokens("access-token-456", "refresh-token-abc", user);
        when(authService.login(any(LoginRequest.class))).thenReturn(tokens);

        LoginRequest request = new LoginRequest("satyam@example.com", "StrongP@ss1");

        mockMvc.perform(post(LOGIN_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isOk())
                .andExpect(header().exists(HttpHeaders.SET_COOKIE))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, org.hamcrest.Matchers.containsString("refreshToken=")))
                .andExpect(jsonPath("$.accessToken").value("access-token-456"))
                .andExpect(jsonPath("$.user.id").value("user-101"))
                .andExpect(jsonPath("$.user.email").value("satyam@example.com"));
    }

    @Test
    void loginWithInvalidCredentialsReturns401() throws Exception {
        when(authService.login(any(LoginRequest.class)))
                .thenThrow(new InvalidCredentialsException());

        LoginRequest request = new LoginRequest("satyam@example.com", "WrongPassword");

        mockMvc.perform(post(LOGIN_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("Unauthorized"))
                .andExpect(jsonPath("$.message").value("Invalid email or password"));
    }

    @Test
    void loginWithBlankFieldsReturns400() throws Exception {
        LoginRequest request = new LoginRequest("", "");

        mockMvc.perform(post(LOGIN_PATH)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(request)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.status").value(400));
    }

    @Test
    void logoutWithValidAuthAndCookieReturns204AndClearsCookie() throws Exception {
        AccessTokenClaims claims = new AccessTokenClaims("user-101", "jti-123", Instant.now().plusSeconds(900));
        UsernamePasswordAuthenticationToken auth =
                UsernamePasswordAuthenticationToken.authenticated("user-101", null, List.of());
        auth.setDetails(claims);

        mockMvc.perform(post(LOGOUT_PATH)
                        .principal(auth)
                        .cookie(new jakarta.servlet.http.Cookie("refreshToken", "refresh-token-xyz")))
                .andExpect(status().isNoContent())
                .andExpect(header().exists(HttpHeaders.SET_COOKIE))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, org.hamcrest.Matchers.containsString("Max-Age=0")));

        verify(authService).logout(eq("user-101"), eq("jti-123"), any(Instant.class), eq("refresh-token-xyz"));
    }

    @Test
    void logoutWithoutCookieStillReturns204AndClearsCookie() throws Exception {
        AccessTokenClaims claims = new AccessTokenClaims("user-101", "jti-123", Instant.now().plusSeconds(900));
        UsernamePasswordAuthenticationToken auth =
                UsernamePasswordAuthenticationToken.authenticated("user-101", null, List.of());
        auth.setDetails(claims);

        mockMvc.perform(post(LOGOUT_PATH).principal(auth))
                .andExpect(status().isNoContent())
                .andExpect(header().exists(HttpHeaders.SET_COOKIE))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, org.hamcrest.Matchers.containsString("Max-Age=0")));

        verify(authService).logout(eq("user-101"), eq("jti-123"), any(Instant.class), isNull());
    }
}
