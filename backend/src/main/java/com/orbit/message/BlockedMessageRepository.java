package com.orbit.message;

import com.orbit.message.model.BlockedMessage;
import org.springframework.data.domain.Pageable;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

@Repository
public interface BlockedMessageRepository extends MongoRepository<BlockedMessage, String> {

    List<BlockedMessage> findByConversationIdAndSenderIdOrderByCreatedAtDesc(String conversationId, String senderId, Pageable pageable);

    List<BlockedMessage> findByConversationIdAndSenderIdAndCreatedAtLessThanOrderByCreatedAtDesc(String conversationId, String senderId, Instant createdAt, Pageable pageable);

    Optional<BlockedMessage> findByConversationIdAndSenderIdAndIdempotencyKey(String conversationId, String senderId, String idempotencyKey);
}
