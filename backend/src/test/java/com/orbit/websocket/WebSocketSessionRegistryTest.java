package com.orbit.websocket;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class WebSocketSessionRegistryTest {

    private WebSocketSessionRegistry registry;

    @BeforeEach
    void setUp() {
        registry = new WebSocketSessionRegistry();
    }

    @Test
    @DisplayName("First session registration marks user online and returns true")
    void registerSession_firstSession_transitionsToOnline() {
        boolean first = registry.registerSession("user-1", "session-a");

        assertThat(first).isTrue();
        assertThat(registry.isOnline("user-1")).isTrue();
        assertThat(registry.getSessionCount("user-1")).isEqualTo(1);
        assertThat(registry.getUserIdForSession("session-a")).isEqualTo("user-1");
        assertThat(registry.getOnlineUserIds()).containsExactly("user-1");
    }

    @Test
    @DisplayName("Subsequent session registrations for same user increment count and return false")
    void registerSession_multipleSessions_incrementsCountWithoutStatusTransition() {
        boolean first = registry.registerSession("user-1", "session-a");
        boolean second = registry.registerSession("user-1", "session-b");

        assertThat(first).isTrue();
        assertThat(second).isFalse();
        assertThat(registry.getSessionCount("user-1")).isEqualTo(2);
        assertThat(registry.getSessionIds("user-1")).containsExactlyInAnyOrder("session-a", "session-b");
    }

    @Test
    @DisplayName("Unregistering one of multiple sessions does not transition user to offline")
    void unregisterSession_partialDisconnect_userRemainsOnline() {
        registry.registerSession("user-1", "session-a");
        registry.registerSession("user-1", "session-b");

        boolean last = registry.unregisterSession("session-a");

        assertThat(last).isFalse();
        assertThat(registry.isOnline("user-1")).isTrue();
        assertThat(registry.getSessionCount("user-1")).isEqualTo(1);
        assertThat(registry.getUserIdForSession("session-a")).isNull();
        assertThat(registry.getUserIdForSession("session-b")).isEqualTo("user-1");
    }

    @Test
    @DisplayName("Unregistering the final session transitions user to offline and returns true")
    void unregisterSession_lastSession_transitionsToOffline() {
        registry.registerSession("user-1", "session-a");

        boolean last = registry.unregisterSession("session-a");

        assertThat(last).isTrue();
        assertThat(registry.isOnline("user-1")).isFalse();
        assertThat(registry.getSessionCount("user-1")).isEqualTo(0);
        assertThat(registry.getUserIdForSession("session-a")).isNull();
        assertThat(registry.getOnlineUserIds()).isEmpty();
    }

    @Test
    @DisplayName("Unregistering non-existent session returns false safely")
    void unregisterSession_unknownSession_returnsFalse() {
        boolean result = registry.unregisterSession("unknown-session");

        assertThat(result).isFalse();
    }

    @Test
    @DisplayName("Multiple distinct users are tracked independently")
    void multipleUsers_trackedSeparately() {
        registry.registerSession("user-1", "sess-1");
        registry.registerSession("user-2", "sess-2");

        assertThat(registry.getOnlineUserIds()).containsExactlyInAnyOrder("user-1", "user-2");
        assertThat(registry.isOnline("user-1")).isTrue();
        assertThat(registry.isOnline("user-2")).isTrue();

        registry.unregisterSession("sess-1");
        assertThat(registry.isOnline("user-1")).isFalse();
        assertThat(registry.isOnline("user-2")).isTrue();
        assertThat(registry.getOnlineUserIds()).containsExactly("user-2");
    }
}
