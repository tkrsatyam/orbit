package com.orbit.auth;

import com.orbit.auth.model.RefreshToken;
import com.orbit.auth.token.JwtService;
import com.orbit.auth.token.RefreshTokenRepository;
import com.orbit.auth.token.TokenBlacklistService;
import com.orbit.user.UserRepository;
import com.orbit.user.model.User;
import com.orbit.user.model.UserRole;
import jakarta.servlet.http.Cookie;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.time.Duration;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "spring.mongodb.uri=mongodb://localhost:27017/orbit_test")
class LogoutEndpointTest {

    private static final String LOGOUT_PATH = "/api/v1/auth/logout";
    private static final String REFRESH_PATH = "/api/v1/auth/refresh";
    private static final String PROTECTED_PATH = "/api/v1/users/me";
    private static final String COOKIE_NAME = RefreshCookieFactory.COOKIE_NAME;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private RefreshTokenRepository refreshTokenRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private TokenBlacklistService tokenBlacklistService;

    private String userId;

    @BeforeEach
    void clean() {
        refreshTokenRepository.deleteAll();
        userRepository.deleteAll();
        userId = new ObjectId().toHexString();
    }

    private User seedUser() {
        User user = User.builder()
                .id(userId)
                .email("satyam@example.com")
                .displayName("Satyam")
                .role(UserRole.USER)
                .online(true)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build();
        return userRepository.save(user);
    }

    private String seedSession(Instant expiresAt) {
        String token = "seed-" + UUID.randomUUID();
        refreshTokenRepository.save(RefreshToken.builder()
                .userId(userId)
                .token(token)
                .expiresAt(expiresAt)
                .createdAt(Instant.now())
                .updatedAt(Instant.now())
                .build());
        return token;
    }

    @Test
    void unauthenticatedLogoutReturns401() throws Exception {
        mockMvc.perform(post(LOGOUT_PATH))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevokesAccessTokenDeletesRefreshTokenAndMarksUserOffline() throws Exception {
        seedUser();
        String refreshToken = seedSession(Instant.now().plus(Duration.ofDays(7)));
        String accessToken = jwtService.generateAccessToken(userId);

        mockMvc.perform(post(LOGOUT_PATH)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken)
                        .cookie(new Cookie(COOKIE_NAME, refreshToken)))
                .andExpect(status().isNoContent())
                .andExpect(header().exists(HttpHeaders.SET_COOKIE))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, org.hamcrest.Matchers.containsString("Max-Age=0")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, org.hamcrest.Matchers.containsString("HttpOnly")))
                .andExpect(header().string(HttpHeaders.SET_COOKIE, org.hamcrest.Matchers.containsString("SameSite=None")));

        // 1. Refresh token is deleted from MongoDB
        assertThat(refreshTokenRepository.findByToken(refreshToken)).isEmpty();

        // 2. Refreshing with the old refresh token now fails with 401
        mockMvc.perform(post(REFRESH_PATH).cookie(new Cookie(COOKIE_NAME, refreshToken)))
                .andExpect(status().isUnauthorized());

        // 3. Access token is blacklisted and rejected on subsequent authenticated requests
        mockMvc.perform(post(LOGOUT_PATH).header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get(PROTECTED_PATH).header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isUnauthorized());

        // 4. User is marked offline in the database and lastSeen is populated
        User updatedUser = userRepository.findById(userId).orElseThrow();
        assertThat(updatedUser.isOnline()).isFalse();
        assertThat(updatedUser.getLastSeen()).isNotNull();
    }

    @Test
    void logoutWithoutCookieStillBlacklistsAccessTokenAndMarksUserOffline() throws Exception {
        seedUser();
        String accessToken = jwtService.generateAccessToken(userId);

        mockMvc.perform(post(LOGOUT_PATH)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isNoContent())
                .andExpect(header().string(HttpHeaders.SET_COOKIE, org.hamcrest.Matchers.containsString("Max-Age=0")));

        // Access token is immediately rejected
        mockMvc.perform(get(PROTECTED_PATH).header(HttpHeaders.AUTHORIZATION, "Bearer " + accessToken))
                .andExpect(status().isUnauthorized());

        // User is marked offline
        User updatedUser = userRepository.findById(userId).orElseThrow();
        assertThat(updatedUser.isOnline()).isFalse();
    }
}
