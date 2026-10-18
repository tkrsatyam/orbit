package com.orbit.auth;

import com.orbit.auth.dto.AuthResponse;
import com.orbit.auth.dto.LoginRequest;
import com.orbit.auth.dto.RegisterRequest;
import com.orbit.auth.dto.UserSummaryResponse;
import com.orbit.common.dto.ErrorResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.headers.Header;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@Tag(name = "Auth", description = "Authentication and session management")
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final OriginVerifier originVerifier;
    private final RefreshCookieFactory refreshCookieFactory;

    public AuthController(AuthService authService,
                          OriginVerifier originVerifier,
                          RefreshCookieFactory refreshCookieFactory) {
        this.authService = authService;
        this.originVerifier = originVerifier;
        this.refreshCookieFactory = refreshCookieFactory;
    }

    @Operation(summary = "Register user", description = "Creates a new user account, sets the refresh token cookie, and returns the access token with user details")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "201",
                    description = "Account successfully created; Set-Cookie header contains initial refresh token",
                    headers = @Header(name = HttpHeaders.SET_COOKIE, description = "HttpOnly refresh cookie", schema = @Schema(type = "string")),
                    content = @Content(schema = @Schema(implementation = AuthResponse.class))
            ),
            @ApiResponse(
                    responseCode = "400",
                    description = "Validation failure (invalid email, weak password, or display name out of range)",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "409",
                    description = "Email is already registered",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "429",
                    description = "Rate limit exceeded (10 requests/minute per IP)",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        AuthTokens tokens = authService.register(request);

        return ResponseEntity.status(HttpStatus.CREATED)
                .header(HttpHeaders.SET_COOKIE, refreshCookieFactory.create(tokens.refreshToken()).toString())
                .body(new AuthResponse(tokens.accessToken(), UserSummaryResponse.from(tokens.user())));
    }

    @Operation(summary = "Authenticate user", description = "Authenticates an existing user, sets the refresh token cookie, and returns the access token with user details")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "Authentication successful; Set-Cookie header contains initial refresh token",
                    headers = @Header(name = HttpHeaders.SET_COOKIE, description = "HttpOnly refresh cookie", schema = @Schema(type = "string")),
                    content = @Content(schema = @Schema(implementation = AuthResponse.class))
            ),
            @ApiResponse(
                    responseCode = "400",
                    description = "Validation failure (blank email or password)",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "401",
                    description = "Invalid email or password",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "429",
                    description = "Rate limit exceeded (10 requests/minute per IP)",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        AuthTokens tokens = authService.login(request);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookieFactory.create(tokens.refreshToken()).toString())
                .body(new AuthResponse(tokens.accessToken(), UserSummaryResponse.from(tokens.user())));
    }

    @Operation(summary = "Refresh access token", description = "Rotates the refresh cookie session and issues a new access token")
    @ApiResponses({
            @ApiResponse(
                    responseCode = "200",
                    description = "New access token issued; Set-Cookie header contains rotated refresh token",
                    headers = @Header(name = HttpHeaders.SET_COOKIE, description = "HttpOnly refresh cookie", schema = @Schema(type = "string")),
                    content = @Content(schema = @Schema(implementation = AuthResponse.class))
            ),
            @ApiResponse(
                    responseCode = "401",
                    description = "Missing, invalid, expired, or already rotated refresh token",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "403",
                    description = "Origin header does not match configured frontend origin",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            ),
            @ApiResponse(
                    responseCode = "429",
                    description = "Rate limit exceeded (10 requests/minute per IP)",
                    content = @Content(schema = @Schema(implementation = ErrorResponse.class))
            )
    })
    @PostMapping("/refresh")
    public ResponseEntity<AuthResponse> refresh(
            @CookieValue(name = RefreshCookieFactory.COOKIE_NAME, required = false) String refreshToken,
            @RequestHeader(name = HttpHeaders.ORIGIN, required = false) String origin) {

        originVerifier.verify(origin);
        AuthTokens tokens = authService.refresh(refreshToken);

        return ResponseEntity.ok()
                .header(HttpHeaders.SET_COOKIE, refreshCookieFactory.create(tokens.refreshToken()).toString())
                .body(new AuthResponse(tokens.accessToken()));
    }
}