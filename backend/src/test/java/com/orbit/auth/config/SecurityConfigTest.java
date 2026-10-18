package com.orbit.auth.config;

import com.orbit.auth.token.AccessTokenClaims;
import com.orbit.auth.AuthController;
import com.orbit.auth.token.JwtService;
import com.orbit.auth.token.TokenBlacklistService;
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
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
@org.springframework.test.context.TestPropertySource(properties = {
        "spring.data.mongodb.auto-index-creation=false",
        "management.health.mongo.enabled=false"
})
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

    /** True when the request got past Spring Security and reached Spring MVC (a controller, or a 404 for a missing one). */
    private boolean reachedMvc(MockHttpServletRequestBuilder request) throws Exception {
        return mockMvc.perform(request).andReturn().getHandler() != null;
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
            assertThat(reachedMvc(post(path))).as(path).isTrue();
        }
    }

    @Test
    void publicEndpointsIgnoreABadAuthorizationHeader() throws Exception {
        // A client with an expired access token must still be able to call /refresh. Without a
        // refresh cookie the controller itself answers 401, so we check that the request reached
        // the controller instead of looking at the status.
        mockMvc.perform(post("/api/v1/auth/refresh").header("Authorization", "Bearer expired-or-garbage"))
                .andExpect(handler().handlerType(AuthController.class));
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
    void documentationEndpointsArePublic() throws Exception {
        for (String path : List.of("/v3/api-docs", "/v3/api-docs.yaml", "/swagger-ui.html", "/swagger-ui/index.html")) {
            assertThat(statusOf(get(path))).isNotIn(401, 403);
        }
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