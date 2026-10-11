package com.orbit.auth.config;

import com.orbit.auth.AccessTokenClaims;
import com.orbit.auth.JwtService;
import com.orbit.auth.TokenBlacklistService;
import com.orbit.common.config.OrbitProperties;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class SecurityConfigTest {

    private static final String PROTECTED_PATH = "/api/v1/users/me";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private TokenBlacklistService blacklist;

    @Autowired
    private OrbitProperties properties;

    private int statusOf(MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request).andReturn().getResponse().getStatus();
    }

    @Test
    void protectedEndpointWithoutTokenReturns401() throws Exception {
        mockMvc.perform(get(PROTECTED_PATH)).andExpect(status().isUnauthorized());
    }

    @Test
    void protectedEndpointWithValidTokenPassesSecurity() throws Exception {
        String token = jwtService.generateAccessToken("user-1");

        int status = statusOf(get(PROTECTED_PATH).header("Authorization", "Bearer " + token));

        assertThat(status).isNotIn(401, 403);
    }

    @Test
    void protectedEndpointWithBlacklistedTokenReturns401() throws Exception {
        String token = jwtService.generateAccessToken("user-1");
        AccessTokenClaims claims = jwtService.validateToken(token);
        blacklist.blacklist(claims.tokenId(), claims.expiresAt());

        mockMvc.perform(get(PROTECTED_PATH).header("Authorization", "Bearer " + token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void protectedEndpointWithInvalidTokenReturns401() throws Exception {
        mockMvc.perform(get(PROTECTED_PATH).header("Authorization", "Bearer not-a-jwt"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void registerLoginAndRefreshArePublic() throws Exception {
        for (String path : List.of("/api/v1/auth/register", "/api/v1/auth/login", "/api/v1/auth/refresh")) {
            assertThat(statusOf(post(path))).as(path).isNotIn(401, 403);
        }
    }

    @Test
    void publicEndpointsIgnoreABadAuthorizationHeader() throws Exception {
        // A client with an expired access token must still be able to call /refresh
        int status = statusOf(post("/api/v1/auth/refresh").header("Authorization", "Bearer expired-or-garbage"));

        assertThat(status).isNotIn(401, 403);
    }

    @Test
    void logoutRequiresAuthentication() throws Exception {
        mockMvc.perform(post("/api/v1/auth/logout")).andExpect(status().isUnauthorized());
    }

    @Test
    void healthEndpointIsPublic() throws Exception {
        assertThat(statusOf(get("/actuator/health"))).isNotIn(401, 403);
    }

    @Test
    void corsPreflightFromAllowedOriginIsAccepted() throws Exception {
        String origin = properties.cors().allowedOrigin();

        mockMvc.perform(options("/api/v1/auth/refresh")
                        .header("Origin", origin)
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", origin))
                .andExpect(header().string("Access-Control-Allow-Credentials", "true"));
    }

    @Test
    void corsPreflightFromAnotherOriginIsRejected() throws Exception {
        mockMvc.perform(options("/api/v1/auth/refresh")
                        .header("Origin", "https://evil.example")
                        .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isForbidden());
    }
}