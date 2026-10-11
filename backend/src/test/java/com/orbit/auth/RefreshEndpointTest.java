package com.orbit.auth;

import com.jayway.jsonpath.JsonPath;
import com.orbit.auth.model.RefreshToken;
import com.orbit.common.config.OrbitProperties;
import jakarta.servlet.http.Cookie;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

/**
 * End-to-end tests of POST /api/v1/auth/refresh through the security chain, CORS,
 * controller, service and a real MongoDB (separate orbit_test database).
 * Assumes the default cookie settings (Secure, SameSite=None).
 */
@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "spring.mongodb.uri=mongodb://localhost:27017/orbit_test")
class RefreshEndpointTest {

    private static final String REFRESH_PATH = "/api/v1/auth/refresh";
    private static final String COOKIE = RefreshCookieFactory.COOKIE_NAME;

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private RefreshTokenRepository repository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private OrbitProperties properties;

    private final String userId = new ObjectId().toHexString();

    @BeforeEach
    void clean() {
        repository.deleteAll();
    }

    private static Instant inSevenDays() {
        return Instant.now().plus(Duration.ofDays(7));
    }

    /** Stores a session directly, the way register/login will, and returns its refresh token value. */
    private String seedSession(Instant expiresAt) {
        String token = "seed-" + UUID.randomUUID();
        repository.save(RefreshToken.builder().userId(userId).token(token).expiresAt(expiresAt).build());
        return token;
    }

    private MockHttpServletRequestBuilder refreshWith(String cookieValue) {
        return post(REFRESH_PATH).cookie(new Cookie(COOKIE, cookieValue));
    }

    /** Calls /refresh, expects 200, and returns the value of the new refresh cookie. */
    private String refreshAndReadNewCookie(String cookieValue) throws Exception {
        return mockMvc.perform(refreshWith(cookieValue))
                .andExpect(status().isOk())
                .andReturn().getResponse().getCookie(COOKIE).getValue();
    }

    @Test
    void refreshRotatesTheSessionAndReturnsANewAccessToken() throws Exception {
        String oldToken = seedSession(inSevenDays());

        MockHttpServletResponse response = mockMvc.perform(refreshWith(oldToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty())
                .andReturn().getResponse();

        // the new access token belongs to the session's user
        String accessToken = JsonPath.read(response.getContentAsString(), "$.accessToken");
        assertThat(jwtService.validateToken(accessToken).userId()).isEqualTo(userId);

        // the new refresh cookie carries the documented attributes and a different value
        assertThat(response.getHeader("Set-Cookie"))
                .contains("HttpOnly")
                .contains("Secure")
                .contains("SameSite=None")
                .contains("Path=/api/v1/auth")
                .contains("Max-Age=604800");
        String newToken = response.getCookie(COOKIE).getValue();
        assertThat(newToken).isNotEqualTo(oldToken);

        // the same MongoDB document was updated in place
        assertThat(repository.count()).isEqualTo(1);
        assertThat(repository.findByToken(oldToken)).isEmpty();
        assertThat(repository.findByToken(newToken))
                .hasValueSatisfying(session -> assertThat(session.getUserId()).isEqualTo(userId));

        // tokens must never be cached
        assertThat(response.getHeader("Cache-Control")).contains("no-store");
    }

    @Test
    void aRotatedCookieIsRejectedButTheNewOneWorks() throws Exception {
        String first = seedSession(inSevenDays());

        String second = refreshAndReadNewCookie(first);
        mockMvc.perform(refreshWith(first)).andExpect(status().isUnauthorized());   // old cookie is dead
        String third = refreshAndReadNewCookie(second);                              // new cookie works

        assertThat(List.of(first, second, third)).doesNotHaveDuplicates();
    }

    @Test
    void missingCookieReturns401AndSetsNoCookie() throws Exception {
        mockMvc.perform(post(REFRESH_PATH))
                .andExpect(status().isUnauthorized())
                .andExpect(cookie().doesNotExist(COOKIE));
    }

    @Test
    void unknownCookieReturns401() throws Exception {
        mockMvc.perform(refreshWith("never-issued"))
                .andExpect(status().isUnauthorized())
                .andExpect(cookie().doesNotExist(COOKIE));
    }

    @Test
    void expiredSessionReturns401() throws Exception {
        String expired = seedSession(Instant.now().minus(Duration.ofMinutes(1)));

        mockMvc.perform(refreshWith(expired))
                .andExpect(status().isUnauthorized())
                .andExpect(cookie().doesNotExist(COOKIE));
    }

    @Test
    void foreignOriginIsRejectedAndTheSessionIsLeftUntouched() throws Exception {
        String token = seedSession(inSevenDays());

        // Rejected by Spring's CORS filter before the controller runs
        mockMvc.perform(refreshWith(token).header("Origin", "https://evil.example"))
                .andExpect(status().isForbidden());

        assertThat(repository.findByToken(token)).isPresent();   // not rotated
    }

    @Test
    void configuredOriginIsAcceptedAndGetsCorsHeaders() throws Exception {
        String origin = properties.cors().allowedOrigin();
        String token = seedSession(inSevenDays());

        mockMvc.perform(refreshWith(token).header("Origin", origin))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", origin))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }

    @Test
    void refreshWorksEvenWhenTheBrowserSendsAnExpiredAccessToken() throws Exception {
        // The real-world case: the access token expired, the browser still sends it, and /refresh must not care.
        String token = seedSession(inSevenDays());

        mockMvc.perform(refreshWith(token).header("Authorization", "Bearer expired-or-garbage"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.accessToken").isNotEmpty());
    }
}