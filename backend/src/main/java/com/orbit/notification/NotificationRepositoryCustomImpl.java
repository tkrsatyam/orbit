package com.orbit.notification;

import com.orbit.notification.model.Notification;
import com.orbit.notification.model.NotificationType;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.query.Criteria;
import org.springframework.data.mongodb.core.query.Query;
import org.springframework.data.mongodb.core.query.Update;
import org.springframework.stereotype.Repository;

import java.time.Instant;

@Repository
public class NotificationRepositoryCustomImpl implements NotificationRepositoryCustom {

    private final MongoTemplate mongoTemplate;

    public NotificationRepositoryCustomImpl(MongoTemplate mongoTemplate) {
        this.mongoTemplate = mongoTemplate;
    }

    @Override
    public void incrementUnreadCount(String userId, String conversationId) {
        Query query = new Query(Criteria.where("userId").is(userId).and("conversationId").is(conversationId));
        Update update = new Update()
                .inc("count", 1)
                .set("read", false)
                .set("type", NotificationType.UNREAD_MESSAGE.name())
                .set("updatedAt", Instant.now())
                .setOnInsert("createdAt", Instant.now());
        mongoTemplate.upsert(query, update, Notification.class);
    }

    @Override
    public void decrementUnreadCount(String userId, String conversationId) {
        Query query = new Query(Criteria.where("userId").is(userId).and("conversationId").is(conversationId).and("count").gt(0));
        Update update = new Update()
                .inc("count", -1)
                .set("updatedAt", Instant.now());
        mongoTemplate.updateFirst(query, update, Notification.class);
    }

    @Override
    public void markConversationAsRead(String userId, String conversationId) {
        Query query = new Query(Criteria.where("userId").is(userId).and("conversationId").is(conversationId));
        Update update = new Update()
                .set("count", 0)
                .set("read", true)
                .set("updatedAt", Instant.now());
        mongoTemplate.updateFirst(query, update, Notification.class);
    }
}
