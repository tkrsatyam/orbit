package com.orbit.websocket;

import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

/**
 * Tracks active WebSocket sessions per userId to support multi-tab connections.
 *
 * <p>Online state changes only trigger when a user transitions from 0 -> 1 sessions
 * (first connection) or from 1 -> 0 sessions (last disconnection), preventing presence
 * flickering when tabs are opened or closed.
 */
@Component
public class WebSocketSessionRegistry {

    private final ConcurrentMap<String, Set<String>> userToSessions = new ConcurrentHashMap<>();
    private final ConcurrentMap<String, String> sessionToUser = new ConcurrentHashMap<>();

    /**
     * Registers a new session for a user.
     *
     * @param userId    the authenticated user ID
     * @param sessionId the WebSocket session ID
     * @return true if this is the user's first active session (user transitioned to online)
     */
    public boolean registerSession(String userId, String sessionId) {
        if (userId == null || sessionId == null) {
            return false;
        }

        sessionToUser.put(sessionId, userId);
        Set<String> sessions = userToSessions.computeIfAbsent(userId, k -> ConcurrentHashMap.newKeySet());
        boolean wasEmpty = sessions.isEmpty();
        sessions.add(sessionId);
        return wasEmpty;
    }

    /**
     * Unregisters a disconnected session.
     *
     * @param sessionId the disconnected WebSocket session ID
     * @return true if the user has no remaining active sessions (user transitioned to offline)
     */
    public boolean unregisterSession(String sessionId) {
        if (sessionId == null) {
            return false;
        }

        String userId = sessionToUser.remove(sessionId);
        if (userId == null) {
            return false;
        }

        Set<String> sessions = userToSessions.get(userId);
        if (sessions == null) {
            return true;
        }

        sessions.remove(sessionId);
        if (sessions.isEmpty()) {
            userToSessions.remove(userId, Collections.emptySet());
            return true;
        }
        return false;
    }

    /**
     * Returns the user ID associated with a session ID, or null if unknown.
     */
    public String getUserIdForSession(String sessionId) {
        if (sessionId == null) {
            return null;
        }
        return sessionToUser.get(sessionId);
    }

    /**
     * Returns the active session count for a user.
     */
    public int getSessionCount(String userId) {
        if (userId == null) {
            return 0;
        }
        Set<String> sessions = userToSessions.get(userId);
        return sessions != null ? sessions.size() : 0;
    }

    /**
     * Returns true if the user has at least one active WebSocket session.
     */
    public boolean isOnline(String userId) {
        return getSessionCount(userId) > 0;
    }

    /**
     * Alias for isOnline.
     */
    public boolean isUserOnline(String userId) {
        return isOnline(userId);
    }

    /**
     * Returns an unmodifiable snapshot of currently online user IDs.
     */
    public Set<String> getOnlineUserIds() {
        return Collections.unmodifiableSet(userToSessions.keySet());
    }

    /**
     * Returns an unmodifiable snapshot of active session IDs for a user.
     */
    public Set<String> getSessionIds(String userId) {
        if (userId == null) {
            return Collections.emptySet();
        }
        Set<String> sessions = userToSessions.get(userId);
        return sessions != null ? Collections.unmodifiableSet(sessions) : Collections.emptySet();
    }
}
