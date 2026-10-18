package com.orbit.auth.dto;

/** Body of POST /api/v1/auth/refresh. A nullable `user` is added with register and login (ORDM-26). */
public record AuthResponse(String accessToken) {
}