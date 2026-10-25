package com.orbit.notification;

import java.util.List;

public interface NotificationRepositoryCustom {

    void incrementUnreadCount(String userId, String conversationId);

    void incrementUnreadCounts(List<String> userIds, String conversationId);

    void decrementUnreadCount(String userId, String conversationId);

    void markConversationAsRead(String userId, String conversationId);
}
