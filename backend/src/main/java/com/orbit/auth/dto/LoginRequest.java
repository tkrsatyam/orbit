package com.orbit.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;

@Schema(description = "User authentication payload")
public record LoginRequest(
        @Schema(description = "User email address", example = "satyam@example.com")
        @NotBlank(message = "Email is required")
        @Email(message = "Invalid email format")
        String email,

        @Schema(description = "Account password", example = "StrongP@ssword1")
        @NotBlank(message = "Password is required")
        String password) {
}
