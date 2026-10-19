package com.orbit.common.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.orbit.common.config.OrbitProperties;
import com.orbit.common.ratelimit.TokenBucketRateLimiter;
import jakarta.servlet.FilterChain;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class RateLimitFilterTest {

    private RateLimitFilter filter;
    private TokenBucketRateLimiter rateLimiter;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        SecurityContextHolder.clearContext();
        rateLimiter = new TokenBucketRateLimiter();
        objectMapper = new ObjectMapper().findAndRegisterModules();

        OrbitProperties.Jwt jwt = new OrbitProperties.Jwt("0123456789abcdef0123456789abcdef", 900000, 604800000);
        OrbitProperties.Cors cors = new OrbitProperties.Cors("http://localhost:4200");
        OrbitProperties.Cookie cookie = new OrbitProperties.Cookie(true, "None");
        OrbitProperties.RateLimit rateLimit = new OrbitProperties.RateLimit(2, 2, 2, 2, 2);
        OrbitProperties properties = new OrbitProperties(jwt, cors, cookie, rateLimit);

        filter = new RateLimitFilter(properties, rateLimiter, objectMapper);
    }

    private void authenticateAs(String userId) {
        SecurityContext context = SecurityContextHolder.createEmptyContext();
        context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(userId, null, List.of()));
        SecurityContextHolder.setContext(context);
    }

    @Test
    void optionsPreflightBypassesRateLimiting() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("OPTIONS", "/api/v1/auth/login");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        assertThat(rateLimiter.size()).isZero();
    }

    @Test
    void nonApiRequestsBypassRateLimiting() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/actuator/health");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        verify(chain).doFilter(request, response);
        assertThat(rateLimiter.size()).isZero();
    }

    @Test
    void unauthenticatedRequestOnProtectedEndpointBypassesRateLimiting() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/users/me");
        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);

        filter.doFilter(request, response, chain);

        // Passed down chain so Spring Security can reject with 401
        verify(chain).doFilter(request, response);
        assertThat(rateLimiter.size()).isZero();
    }

    @Test
    void unauthenticatedAuthEndpointsAreRateLimitedByClientIp() throws Exception {
        MockHttpServletRequest request1 = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request1.setRemoteAddr("10.0.0.1");

        MockHttpServletResponse response1 = new MockHttpServletResponse();
        filter.doFilter(request1, response1, new MockFilterChain());
        assertThat(response1.getStatus()).isEqualTo(HttpStatus.OK.value());

        MockHttpServletResponse response2 = new MockHttpServletResponse();
        filter.doFilter(request1, response2, new MockFilterChain());
        assertThat(response2.getStatus()).isEqualTo(HttpStatus.OK.value());

        // 3rd attempt exceeds limit of 2
        MockHttpServletResponse response3 = new MockHttpServletResponse();
        FilterChain chain = mock(FilterChain.class);
        filter.doFilter(request1, response3, chain);

        assertThat(response3.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
        assertThat(response3.getHeader(HttpHeaders.RETRY_AFTER)).isNotNull();
        assertThat(response3.getContentAsString()).contains("Rate limit exceeded");
        verify(chain, never()).doFilter(any(), any());

        // Different IP is not blocked
        MockHttpServletRequest request2 = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request2.setRemoteAddr("10.0.0.2");
        MockHttpServletResponse responseOtherIp = new MockHttpServletResponse();
        filter.doFilter(request2, responseOtherIp, new MockFilterChain());
        assertThat(responseOtherIp.getStatus()).isEqualTo(HttpStatus.OK.value());
    }

    @Test
    void extractsClientIpFromXForwardedForHeader() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/v1/auth/login");
        request.addHeader("X-Forwarded-For", "203.0.113.195, 70.41.3.18");

        MockHttpServletResponse response1 = new MockHttpServletResponse();
        filter.doFilter(request, response1, new MockFilterChain());
        MockHttpServletResponse response2 = new MockHttpServletResponse();
        filter.doFilter(request, response2, new MockFilterChain());

        // 3rd exceeds
        MockHttpServletResponse response3 = new MockHttpServletResponse();
        filter.doFilter(request, response3, new MockFilterChain());
        assertThat(response3.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());
    }

    @Test
    void authenticatedRequestsAreScopedByUserIdAcrossGroups() throws Exception {
        authenticateAs("user-1");

        // Message group: POST /api/v1/conversations/123/messages
        MockHttpServletRequest msgReq = new MockHttpServletRequest("POST", "/api/v1/conversations/123/messages");
        filter.doFilter(msgReq, new MockHttpServletResponse(), new MockFilterChain());
        filter.doFilter(msgReq, new MockHttpServletResponse(), new MockFilterChain());

        MockHttpServletResponse msgExceeded = new MockHttpServletResponse();
        filter.doFilter(msgReq, msgExceeded, new MockFilterChain());
        assertThat(msgExceeded.getStatus()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS.value());

        // AI group has independent capacity for the same user
        MockHttpServletRequest aiReq = new MockHttpServletRequest("POST", "/api/v1/ai/summary");
        MockHttpServletResponse aiResponse = new MockHttpServletResponse();
        filter.doFilter(aiReq, aiResponse, new MockFilterChain());
        assertThat(aiResponse.getStatus()).isEqualTo(HttpStatus.OK.value());
    }
}
