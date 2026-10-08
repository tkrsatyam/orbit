package com.orbit.auth.filter;

import com.orbit.auth.AccessTokenClaims;
import com.orbit.auth.JwtService;
import com.orbit.auth.TokenBlacklistService;
import com.orbit.common.config.OrbitProperties;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;

class JwtAuthenticationFilterTest {
    
    private static final String SECRET = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";
    
    private final JwtService jwtService = new JwtService(new OrbitProperties(
            new OrbitProperties.Jwt(SECRET, 900_000L, 604_800_000L),
            new OrbitProperties.Cors("http://localhost:5173")));
    private final TokenBlacklistService blacklist = new TokenBlacklistService();
    private final JwtAuthenticationFilter filter = new JwtAuthenticationFilter(jwtService, blacklist);
    
    private final MockHttpServletRequest request = new MockHttpServletRequest();
    private final MockHttpServletResponse response = new MockHttpServletResponse();
    private final MockFilterChain chain = new MockFilterChain();
    
    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }
    
    private Authentication currentAuthentication() {
        return SecurityContextHolder.getContext().getAuthentication();
    }
    
    @Test
    void validBearerTokenAuthenticatesTheUser() throws Exception {
        request.addHeader("Authorization", "Bearer " + jwtService.generateAccessToken("user-1"));
        
        filter.doFilter(request, response, chain);
        
        Authentication authentication = currentAuthentication();
        assertThat(authentication).isNotNull();
        assertThat(authentication.isAuthenticated()).isTrue();
        assertThat(authentication.getName()).isEqualTo("user-1");
        assertThat(authentication.getDetails()).isInstanceOf(AccessTokenClaims.class);
        assertThat(chain.getRequest()).isNotNull();
    }
    
    @Test
    void requestWithoutAuthorizationHeaderStaysUnauthenticated() throws Exception {
        filter.doFilter(request, response, chain);
        
        assertThat(currentAuthentication()).isNull();
        assertThat(chain.getRequest()).isNotNull();
    }
    
    @Test
    void nonBearerSchemeIsIgnored() throws Exception {
        request.addHeader("Authorization", "Basic dXNlcjpwYXNz");

        filter.doFilter(request, response, chain);

        assertThat(currentAuthentication()).isNull();
        assertThat(chain.getRequest()).isNotNull();
    }
    
    @Test
    void invalidTokenStaysUnauthenticatedAndRequestContinues() throws Exception {
        request.addHeader("Authorization", "Bearer not-a-jwt");

        filter.doFilter(request, response, chain);

        assertThat(currentAuthentication()).isNull();
        assertThat(chain.getRequest()).isNotNull();
    }
    
    @Test
    void blacklistedTokenStaysUnauthenticated() throws Exception {
        String token = jwtService.generateAccessToken("user-1");
        AccessTokenClaims claims = jwtService.parseAccessToken(token);
        blacklist.blacklist(claims.tokenId(), claims.expiresAt());
        request.addHeader("Authorization", "Bearer " + token);

        filter.doFilter(request, response, chain);

        assertThat(currentAuthentication()).isNull();
        assertThat(chain.getRequest()).isNotNull();
    }
}
