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
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.*;

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

    private static Instant inSevenDays() {
        return Instant.now().plus(Duration.ofDays(7));
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

    @Test
    void rotateReplacesTheTokenInPlace() {
        RefreshToken original = repository.save(newToken("old-token"));

        Optional<RefreshToken> rotated = repository.rotate("old-token", "new-token", inSevenDays());

        assertThat(rotated).hasValueSatisfying(session -> {
            assertThat(session.getId()).isEqualTo(original.getId());   // same document, updated in place
            assertThat(session.getUserId()).isEqualTo(original.getUserId());
            assertThat(session.getToken()).isEqualTo("new-token");
            assertThat(session.getUpdatedAt()).isNotNull();
        });
        assertThat(repository.findByToken("old-token")).isEmpty();
        assertThat(repository.findByToken("new-token")).isPresent();
        assertThat(repository.count()).isEqualTo(1);
    }

    @Test
    void rotateRejectsAnUnknownToken() {
        repository.save(newToken("tok-1"));

        assertThat(repository.rotate("missing", "new-token", inSevenDays())).isEmpty();
        assertThat(repository.findByToken("tok-1")).isPresent();   // untouched
    }

    @Test
    void rotateRejectsAnExpiredToken() {
        RefreshToken expired = newToken("expired-token");
        expired.setExpiresAt(Instant.now().minus(Duration.ofMinutes(1)));
        repository.save(expired);

        assertThat(repository.rotate("expired-token", "new-token", inSevenDays())).isEmpty();
    }

    @Test
    void aRotatedTokenCannotBeRotatedAgain() {
        repository.save(newToken("old-token"));
        repository.rotate("old-token", "new-token", inSevenDays());

        assertThat(repository.rotate("old-token", "another-token", inSevenDays())).isEmpty();
    }

    @Test
    void concurrentRotationOfTheSameTokenHasExactlyOneWinner() throws Exception {
        repository.save(newToken("shared-token"));
        Instant newExpiry = inSevenDays();
        int attempts = 8;
        ExecutorService pool = Executors.newFixedThreadPool(attempts);
        CountDownLatch start = new CountDownLatch(1);

        List<Future<Optional<RefreshToken>>> results = new ArrayList<>();
        for (int i = 0; i < attempts; i++) {
            String newValue = "rotated-" + i;
            results.add(pool.submit(() -> {
                start.await();   // all threads wait here, then fire at the same moment
                return repository.rotate("shared-token", newValue, newExpiry);
            }));
        }
        start.countDown();

        int winners = 0;
        for (Future<Optional<RefreshToken>> result : results) {
            if (result.get(10, TimeUnit.SECONDS).isPresent()) {
                winners++;
            }
        }
        pool.shutdown();

        assertThat(winners).isEqualTo(1);
    }
}
