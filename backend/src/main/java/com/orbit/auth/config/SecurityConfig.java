package com.orbit.auth.config;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.orbit.auth.filter.JwtAuthenticationFilter;
import com.orbit.auth.token.JwtService;
import com.orbit.auth.token.TokenBlacklistService;
import com.orbit.common.config.OrbitProperties;
import com.orbit.common.filter.RateLimitFilter;
import com.orbit.common.ratelimit.TokenBucketRateLimiter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http,
                                            JwtService jwtService,
                                            TokenBlacklistService tokenBlacklistService,
                                            OrbitAuthenticationEntryPoint authenticationEntryPoint,
                                            OrbitAccessDeniedHandler accessDeniedHandler,
                                            OrbitProperties properties,
                                            TokenBucketRateLimiter rateLimiter,
                                            ObjectMapper objectMapper) {
        http
                // Stateless API with bearer tokens, so Spring's session-oriented CSRF filter is not needed.
                // The one cookie-based endpoint (/refresh) gets an Origin check instead.
                .csrf(AbstractHttpConfigurer::disable)
                .cors(Customizer.withDefaults())    // uses the corsConfigurationSource bean below
                .sessionManagement(session -> session
                        .sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers("/api/v1/auth/register",
                                "/api/v1/auth/login",
                                "/api/v1/auth/refresh").permitAll()
                        .requestMatchers("/v3/api-docs", "/v3/api-docs/**", "/v3/api-docs.yaml",
                                "/swagger-ui/**", "/swagger-ui.html").permitAll()
                        .requestMatchers("/actuator/health", "/actuator/health/**").permitAll()
                        .requestMatchers("/error").permitAll()
                        .anyRequest().authenticated())
                .exceptionHandling(ex -> ex
                        .authenticationEntryPoint(authenticationEntryPoint)
                        .accessDeniedHandler(accessDeniedHandler))
                .addFilterBefore(new JwtAuthenticationFilter(jwtService, tokenBlacklistService),
                        UsernamePasswordAuthenticationFilter.class)
                .addFilterAfter(new RateLimitFilter(properties, rateLimiter, objectMapper),
                        JwtAuthenticationFilter.class);

        return http.build();
    }

    /**
     * Exact frontend origin with credentials allowed (required for the cross-origin refresh
     * cookie). Never a wildcard origin.
     */
    @Bean
    CorsConfigurationSource corsConfigurationSource(OrbitProperties properties) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(List.of(properties.cors().allowedOrigin()));
        configuration.setAllowedMethods(List.of("GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Authorization", "Content-Type"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);

        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/**", configuration);
        return source;
    }

    /**
     * Declared only so Spring Boot does not create its default in-memory user with a
     * generated password. Logins are verified in AuthService (BCrypt), not through
     * Spring's username/password machinery.
     */
    @Bean
    UserDetailsService userDetailsService() {
        return username -> {
            throw new UsernameNotFoundException("Username/password login is not used");
        };
    }

    @Bean
    public org.springframework.security.crypto.password.PasswordEncoder passwordEncoder() {
        return new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder(12);
    }
}
