package com.orbit.conversation;

import com.orbit.conversation.model.Conversation;
import com.orbit.conversation.model.ConversationType;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ConversationRepository extends MongoRepository<Conversation, String> {

    @Query("{ 'type': 'DIRECT', 'participantIds': { $all: [?0, ?1] } }")
    Optional<Conversation> findDirectConversationBetween(String user1Id, String user2Id);

    List<Conversation> findByParticipantIdsContaining(String userId);

    Optional<Conversation> findByGroupId(String groupId);
}
