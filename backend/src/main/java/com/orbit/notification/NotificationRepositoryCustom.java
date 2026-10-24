package com.orbit.notification;

public interface NotificationRepositoryCustom {

    void incrementUnreadCount(String userId, String conversationId);

    void decrementUnreadCount(String userId, String conversationId);

    void markConversationAsRead(String userId, String conversationId);
}
