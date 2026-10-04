package com.orbit.auth.model;

import lombok.*;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.Id;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.mongodb.core.index.Indexed;
import org.springframework.data.mongodb.core.mapping.Document;
import org.springframework.data.mongodb.core.mapping.Field;
import org.springframework.data.mongodb.core.mapping.FieldType;

import java.time.Instant;

@Document(collection = "refreshTokens")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class RefreshToken {
    
    @Id
    private String id;
    
    @Indexed
    @Field(targetType = FieldType.OBJECT_ID)
    private String userId;

    /** Opaque value sent to the client in the httpOnly cookie. */
    @Indexed(unique = true)
    private String token;

    /** TTL index: MongoDB purges the document once this instant has passed. */
    @Indexed(expireAfter = "0s")
    private Instant expiresAt;
    
    @CreatedDate
    private Instant createdAt;
    
    @LastModifiedDate
    private Instant updatedAt;
}
