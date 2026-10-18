package com.orbit.auth.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.security.authentication.BadCredentialsException;

import static org.assertj.core.api.Assertions.assertThat;

class OrbitAuthenticationEntryPointTest {

    @Test
    void commencesWithStructuredErrorResponse() throws Exception {
        ObjectMapper objectMapper = new ObjectMapper().findAndRegisterModules();
        OrbitAuthenticationEntryPoint entryPoint = new OrbitAuthenticationEntryPoint(objectMapper);

        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/users/me");
        MockHttpServletResponse response = new MockHttpServletResponse();

        entryPoint.commence(request, response, new BadCredentialsException("Bad token"));

        assertThat(response.getStatus()).isEqualTo(HttpStatus.UNAUTHORIZED.value());
        assertThat(response.getContentType()).contains("application/json");

        String body = response.getContentAsString();
        assertThat(body).contains("\"status\":401");
        assertThat(body).contains("\"error\":\"Unauthorized\"");
        assertThat(body).contains("\"message\":\"Full authentication is required to access this resource\"");
        assertThat(body).contains("\"path\":\"/api/v1/users/me\"");
    }
}
