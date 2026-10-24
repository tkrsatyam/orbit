package com.orbit.message;

import com.orbit.message.model.Message;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface MessageRepository extends MongoRepository<Message, String> {

    List<Message> findByConversationIdOrderByCreatedAtDesc(String conversationId, Pageable pageable);

    List<Message> findByConversationIdAndCreatedAtLessThanOrderByCreatedAtDesc(String conversationId, Instant createdAt, Pageable pageable);

    @Query(value = "{ 'conversationId': ?0, 'deletedFor': { '$ne': ?1 } }", sort = "{ 'createdAt': -1 }")
    List<Message> findByConversationIdAndNotDeletedForOrderByCreatedAtDesc(String conversationId, String userId, Pageable pageable);

    @Query(value = "{ 'conversationId': ?0, 'deletedFor': { '$ne': ?1 }, 'createdAt': { '$lt': ?2 } }", sort = "{ 'createdAt': -1 }")
    List<Message> findByConversationIdAndNotDeletedForAndCreatedAtLessThanOrderByCreatedAtDesc(String conversationId, String userId, Instant createdAt, Pageable pageable);

    @Query(value = "{ 'conversationId': ?0, 'deletedFor': { '$ne': ?1 } }", sort = "{ 'createdAt': -1 }")
    List<Message> findTopByConversationIdAndNotDeletedForOrderByCreatedAtDesc(String conversationId, String userId, Pageable pageable);

    Optional<Message> findByConversationIdAndIdempotencyKey(String conversationId, String idempotencyKey);
}
