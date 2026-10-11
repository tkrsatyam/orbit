package com.orbit.auth;

import com.orbit.auth.model.RefreshToken;
import org.springframework.data.mongodb.core.FindAndModifyOptions;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;

import java.time.Instant;
import java.util.Optional;

public class RefreshTokenRepositoryCustomImpl implements RefreshTokenRepositoryCustom {

    private final MongoTemplate mongoTemplate;

    public RefreshTokenRepositoryCustomImpl(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public Optional<RefreshToken> rotate(String presentedToken, String newToken, Instant newExpiresAt) {
        Instant now = Instant.now();
        Query query = new Query(Criteria.where("token").is(presentedToken).and("expiresAt").gt(now));
        // updatedAt is set by hand: @LastModifiedDate auditing only applies to save(), not to template updates
        Update update = new Update()
                .set("token", newToken)
                .set("expiresAt", newExpiresAt)
                .set("updatedAt", now);

        RefreshToken rotated = mongoTemplate.findAndModify(
                query, update, FindAndModifyOptions.options().returnNew(true), RefreshToken.class);
        return Optional.ofNullable(rotated);
    }
}