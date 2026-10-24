package com.orbit.message;

import com.orbit.message.model.BlockedMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface BlockedMessageRepository extends MongoRepository<BlockedMessage, String> {

    List<BlockedMessage> findByConversationIdAndSenderIdOrderByCreatedAtDesc(String conversationId, String senderId, Pageable pageable);

    List<BlockedMessage> findByConversationIdAndSenderIdAndCreatedAtLessThanOrderByCreatedAtDesc(String conversationId, String senderId, Instant createdAt, Pageable pageable);

    @Query(value = "{ 'conversationId': ?0, 'senderId': ?1, 'deletedFor': { '$ne': ?1 } }", sort = "{ 'createdAt': -1 }")
    List<BlockedMessage> findByConversationIdAndSenderIdAndNotDeletedForOrderByCreatedAtDesc(String conversationId, String senderId, Pageable pageable);

    @Query(value = "{ 'conversationId': ?0, 'senderId': ?1, 'deletedFor': { '$ne': ?1 }, 'createdAt': { '$lt': ?2 } }", sort = "{ 'createdAt': -1 }")
    List<BlockedMessage> findByConversationIdAndSenderIdAndNotDeletedForAndCreatedAtLessThanOrderByCreatedAtDesc(String conversationId, String senderId, Instant createdAt, Pageable pageable);

    Optional<BlockedMessage> findByConversationIdAndSenderIdAndIdempotencyKey(String conversationId, String senderId, String idempotencyKey);
}
