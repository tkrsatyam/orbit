package com.orbit.user;

import com.orbit.auth.token.AccessTokenClaims;
import com.orbit.auth.token.JwtService;
import com.orbit.auth.token.TokenBlacklistService;
import com.orbit.user.model.User;
import com.orbit.user.model.UserRole;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.http.HttpHeaders;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
@TestPropertySource(properties = "spring.mongodb.uri=mongodb://localhost:27017/orbit_test")
class UserEndpointIntegrationTest {

    private static final String ME_PATH = "/api/v1/users/me";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private JwtService jwtService;

    @Autowired
    private TokenBlacklistService tokenBlacklistService;

    private User seededUser;

    @BeforeEach
    void setUp() {
        userRepository.deleteAll();
        seededUser = userRepository.save(User.builder()
                .email("satyam.profile@example.com")
                .passwordHash("hashed-pw")
                .displayName("Satyam Kumar")
                .bio("Building Orbit chat app")
                .avatarUrl("https://example.com/satyam.png")
                .role(UserRole.USER)
                .online(true)
                .build());
    }

    @Test
    void getSelfProfileWithoutTokenReturns401() throws Exception {
        mockMvc.perform(get(ME_PATH))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("Unauthorized"))
                .andExpect(jsonPath("$.path").value(ME_PATH));
    }

    @Test
    void getSelfProfileWithInvalidTokenReturns401() throws Exception {
        mockMvc.perform(get(ME_PATH).header(HttpHeaders.AUTHORIZATION, "Bearer invalid-token-xyz"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401))
                .andExpect(jsonPath("$.error").value("Unauthorized"));
    }

    @Test
    void getSelfProfileWithValidBearerTokenReturns200AndFullProfile() throws Exception {
        String token = jwtService.generateAccessToken(seededUser.getId());

        mockMvc.perform(get(ME_PATH).header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(seededUser.getId()))
                .andExpect(jsonPath("$.email").value("satyam.profile@example.com"))
                .andExpect(jsonPath("$.displayName").value("Satyam Kumar"))
                .andExpect(jsonPath("$.bio").value("Building Orbit chat app"))
                .andExpect(jsonPath("$.avatarUrl").value("https://example.com/satyam.png"))
                .andExpect(jsonPath("$.createdAt").isNotEmpty());
    }

    @Test
    void getSelfProfileWithNonExistentUserTokenReturns404() throws Exception {
        String nonexistentUserId = new ObjectId().toHexString();
        String token = jwtService.generateAccessToken(nonexistentUserId);

        mockMvc.perform(get(ME_PATH).header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.status").value(404))
                .andExpect(jsonPath("$.error").value("Not Found"))
                .andExpect(jsonPath("$.path").value(ME_PATH));
    }

    @Test
    void getSelfProfileWithBlacklistedTokenReturns401() throws Exception {
        String token = jwtService.generateAccessToken(seededUser.getId());
        AccessTokenClaims claims = jwtService.validateToken(token);
        tokenBlacklistService.blacklist(claims.tokenId(), claims.expiresAt());

        mockMvc.perform(get(ME_PATH).header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.status").value(401));
    }

    @Test
    void getSelfProfileWithNullBioAndAvatarReturnsNullsGracefully() throws Exception {
        User minimalUser = userRepository.save(User.builder()
                .email("minimal@example.com")
                .passwordHash("hashed")
                .displayName("Minimal User")
                .bio(null)
                .avatarUrl(null)
                .role(UserRole.USER)
                .build());

        String token = jwtService.generateAccessToken(minimalUser.getId());

        mockMvc.perform(get(ME_PATH).header(HttpHeaders.AUTHORIZATION, "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(minimalUser.getId()))
                .andExpect(jsonPath("$.email").value("minimal@example.com"))
                .andExpect(jsonPath("$.displayName").value("Minimal User"))
                .andExpect(jsonPath("$.bio").isEmpty())
                .andExpect(jsonPath("$.avatarUrl").isEmpty());
    }

    @Test
    void getSelfProfilePreflightCorsAllowsFrontendOrigin() throws Exception {
        mockMvc.perform(options(ME_PATH)
                        .header(HttpHeaders.ORIGIN, "http://localhost:4200")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_METHOD, "GET")
                        .header(HttpHeaders.ACCESS_CONTROL_REQUEST_HEADERS, "Authorization"))
                .andExpect(status().isOk())
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_ORIGIN, "http://localhost:4200"))
                .andExpect(header().string(HttpHeaders.ACCESS_CONTROL_ALLOW_CREDENTIALS, "true"))
                .andExpect(header().exists(HttpHeaders.ACCESS_CONTROL_ALLOW_METHODS));
    }
}
