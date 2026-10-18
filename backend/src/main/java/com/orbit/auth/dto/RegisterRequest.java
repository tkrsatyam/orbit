package com.orbit.auth.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

@Schema(description = "User registration payload")
public record RegisterRequest(
        @Schema(description = "User email address", example = "satyam@example.com")
        @NotBlank(message = "Email is required")
        @Email(message = "Invalid email format")
        String email,

        @Schema(description = "Password (minimum 8 characters, at least one uppercase, one lowercase, one digit, and one special character)", example = "StrongP@ssword1")
        @NotBlank(message = "Password is required")
        @Pattern(
                regexp = "^(?=.*[a-z])(?=.*[A-Z])(?=.*\\d)(?=.*[^A-Za-z\\d])\\S{8,}$",
                message = "Password must be at least 8 characters long and contain at least one uppercase letter, one lowercase letter, one digit, and one special character"
        )
        String password,

        @Schema(description = "User display name (2 to 50 characters)", example = "Satyam")
        @NotBlank(message = "Display name is required")
        @Size(min = 2, max = 50, message = "Display name must be between 2 and 50 characters")
        String displayName) {
}
