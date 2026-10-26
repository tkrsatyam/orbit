package com.orbit.common.filter;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.orbit.common.config.OrbitProperties;
import com.orbit.common.dto.ErrorResponse;
import com.orbit.common.ratelimit.ConsumptionResult;
import com.orbit.common.ratelimit.TokenBucketRateLimiter;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.regex.Pattern;

/**
 * Applies token-bucket rate limiting to requests under /api/v1/.
 * Sits after JwtAuthenticationFilter so that SecurityContext holds the authenticated userId.
 *
 * <p>Deliberately not a @Component: created and registered explicitly in SecurityConfig
 * so it is not duplicated in Spring Boot's standalone servlet filter chain.
 */
public class RateLimitFilter extends OncePerRequestFilter {

    public static final String RATE_LIMIT_CONSUMED_ATTR = "orbit.rateLimit.messages.consumed";

    private static final String API_PREFIX = "/api/v1/";
    private static final Pattern MESSAGE_SEND_PATTERN = Pattern.compile("^/api/v1/conversations/[^/]+/messages$");
    private static final Pattern UPLOAD_PATTERN = Pattern.compile("^/api/v1/(conversations/[^/]+/messages/upload|users/me/avatar|groups/[^/]+/avatar|groups/[^/]+/cover)$");

    private final OrbitProperties properties;
    private final TokenBucketRateLimiter rateLimiter;
    private final ObjectMapper objectMapper;

    public RateLimitFilter(OrbitProperties properties,
                            TokenBucketRateLimiter rateLimiter,
                            ObjectMapper objectMapper) {
        this.properties = properties;
        this.rateLimiter = rateLimiter;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {

        if (shouldBypass(request)) {
            filterChain.doFilter(request, response);
            return;
        }

        String path = request.getRequestURI();
        String method = request.getMethod();
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        boolean isAuthenticated = auth != null && auth.isAuthenticated() && !"anonymousUser".equals(auth.getPrincipal());

        EndpointRateLimit plan = resolveRateLimit(path, method, isAuthenticated, request);
        if (plan == null) {
            // Unauthenticated request on a protected endpoint: skip rate-limiting and let Security reject it.
            filterChain.doFilter(request, response);
            return;
        }

        ConsumptionResult result = rateLimiter.tryConsume(plan.key(), plan.limitPerMinute());
        if (!result.allowed()) {
            rejectWith429(request, response, result.retryAfterSeconds());
            return;
        }

        if (plan.key().startsWith("MESSAGES:user:")) {
            request.setAttribute(RATE_LIMIT_CONSUMED_ATTR, Boolean.TRUE);
        }

        filterChain.doFilter(request, response);
    }

    private boolean shouldBypass(HttpServletRequest request) {
        if (HttpMethod.OPTIONS.matches(request.getMethod())) {
            return true;
        }
        String path = request.getRequestURI();
        return !path.startsWith(API_PREFIX);
    }

    private EndpointRateLimit resolveRateLimit(String path, String method, boolean isAuthenticated, HttpServletRequest request) {
        OrbitProperties.RateLimit limits = properties.rateLimit();

        if (path.startsWith("/api/v1/auth/")) {
            boolean isPublicAuth = path.equals("/api/v1/auth/register")
                    || path.equals("/api/v1/auth/login")
                    || path.equals("/api/v1/auth/refresh");

            if (isPublicAuth) {
                String ip = extractClientIp(request);
                return new EndpointRateLimit("AUTH:ip:" + ip, limits.authPerMinute());
            }

            if (!isAuthenticated) {
                return null;
            }

            return new EndpointRateLimit("AUTH:user:" + getUserId(), limits.authPerMinute());
        }

        if (!isAuthenticated) {
            return null;
        }

        String userId = getUserId();

        if (path.startsWith("/api/v1/ai/")) {
            return new EndpointRateLimit("AI:user:" + userId, limits.aiRequestsPerMinute());
        }

        if (HttpMethod.POST.matches(method) && UPLOAD_PATTERN.matcher(path).matches()) {
            return new EndpointRateLimit("UPLOAD:user:" + userId, limits.uploadsPerMinute());
        }

        if (HttpMethod.POST.matches(method) && MESSAGE_SEND_PATTERN.matcher(path).matches()) {
            return new EndpointRateLimit("MESSAGES:user:" + userId, limits.messagesPerMinute());
        }

        return new EndpointRateLimit("DEFAULT:user:" + userId, limits.defaultPerMinute());
    }

    private String getUserId() {
        return SecurityContextHolder.getContext().getAuthentication().getName();
    }

    private String extractClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isBlank()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    private void rejectWith429(HttpServletRequest request, HttpServletResponse response, long retryAfterSeconds) throws IOException {
        response.setStatus(HttpStatus.TOO_MANY_REQUESTS.value());
        response.setHeader(HttpHeaders.RETRY_AFTER, String.valueOf(retryAfterSeconds));
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);

        ErrorResponse errorResponse = ErrorResponse.of(
                HttpStatus.TOO_MANY_REQUESTS.value(),
                HttpStatus.TOO_MANY_REQUESTS.getReasonPhrase(),
                "Rate limit exceeded. Try again in " + retryAfterSeconds + " seconds",
                request.getRequestURI());

        objectMapper.writeValue(response.getOutputStream(), errorResponse);
    }

    private record EndpointRateLimit(String key, int limitPerMinute) {
    }
}
