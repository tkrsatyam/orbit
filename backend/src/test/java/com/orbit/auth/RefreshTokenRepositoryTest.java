package com.orbit.auth;

import com.orbit.auth.model.RefreshToken;
import com.orbit.common.config.MongoConfig;
import org.bson.types.ObjectId;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.data.mongodb.test.autoconfigure.DataMongoTest;
import org.springframework.context.annotation.Import;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.index.IndexInfo;
import org.springframework.test.context.TestPropertySource;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@DataMongoTest
@Import(MongoConfig.class)
@TestPropertySource(properties = "spring.mongodb.uri=mongodb://localhost:27017/orbit_test")
class RefreshTokenRepositoryTest {
    
    @Autowired
    private RefreshTokenRepository repository;
    
    @Autowired
    private MongoTemplate mongoTemplate;
    
    @BeforeEach
    void clean() {
        repository.deleteAll();
    }
    
    private RefreshToken newToken(String value) {
        return RefreshToken.builder()
                .userId(new ObjectId().toHexString())
                .token(value)
                .expiresAt(Instant.now().plus(Duration.ofDays(7)))
                .build();
    }
    
    private List<IndexInfo> indexes() {
        return mongoTemplate.indexOps(RefreshToken.class).getIndexInfo();
    }
    
    @Test
    void saveSetsAuditTimestamps() {
        RefreshToken saved = repository.save(newToken("tok-1"));
        
        assertThat(saved.getCreatedAt()).isNotNull();
        assertThat(saved.getUpdatedAt()).isNotNull();
    }
    
    @Test
    void findByTokenReturnsTheSavedDocument() {
        repository.save(newToken("tok-1"));
        
        assertThat(repository.findByToken("tok-1"))
                .hasValueSatisfying(found -> assertThat(found.getToken()).isEqualTo("tok-1"));
    }
    
    @Test
    void findByTokenReturnsEmptyWhenTokenDoesNotExist() {
        repository.save(newToken("tok-1"));
        
        assertThat(repository.findByToken("missing")).isEmpty();
    }
    
    @Test
    void duplicateTokenIsRejectedByUniqueIndex() {
        repository.save(newToken("dup"));
        
        assertThatThrownBy(() -> repository.save(newToken("dup"))).isInstanceOf(DuplicateKeyException.class);
    }
    
    @Test
    void tokenFieldHasUniqueIndex() {
        assertThat(indexes()).anyMatch(i ->
                i.isUnique() && i.getIndexFields().getFirst().getKey().equals("token"));
    }
    
    @Test
    void userIdFieldIsIndexed() {
        assertThat(indexes()).anyMatch(i -> 
                i.getIndexFields().getFirst().getKey().equals("userId"));
    }
    
    @Test
    void expiresAtHasTtlIndexWithZeroDelay() {
        assertThat(indexes()).anyMatch(i -> 
                i.getIndexFields().getFirst().getKey().equals("expiresAt") 
                        && i.getExpireAfter().isPresent() 
                        && i.getExpireAfter().get().isZero());
    }
}
