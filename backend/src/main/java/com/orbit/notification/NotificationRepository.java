package com.orbit.notification;

import com.orbit.notification.model.Notification;
import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface NotificationRepository extends MongoRepository<Notification, String>, NotificationRepositoryCustom {

    Optional<Notification> findByUserIdAndConversationId(String userId, String conversationId);

    List<Notification> findByUserIdAndReadFalse(String userId);
}
