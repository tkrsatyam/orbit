package com.orbit.user.model;

import jakarta.validation.constraints.Size;
import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.index.TextIndexed;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;

/**
 * Stores user credentials, profile data, and avatar reference.
 * See docs/architecture/erd.md (users collection).
 */
@Document(collection = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {

    @Id
    private String id;

    @Indexed(unique = true)
    private String email;

    private String passwordHash;

    @TextIndexed
    @Size(min = 2, max = 50, message = "Display name must be between 2 and 50 characters")
    private String displayName;

    @Size(max = 500, message = "Bio must not exceed 500 characters")
    private String bio;

    private String avatarUrl;

    @Builder.Default
    private UserRole role = UserRole.USER;

    @Builder.Default
    private boolean online = false;

    private Instant lastSeen;

    @CreatedDate
    private Instant createdAt;

    @LastModifiedDate
    private Instant updatedAt;
}
