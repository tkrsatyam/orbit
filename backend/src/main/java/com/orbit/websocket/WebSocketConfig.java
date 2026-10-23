package com.orbit.websocket;

import com.orbit.common.config.OrbitProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.scheduling.concurrent.ThreadPoolTaskScheduler;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

/**
 * Configures the Spring STOMP over WebSocket broker, endpoints, heartbeats, and user routing.
 */
@Configuration
@EnableWebSocketMessageBroker
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final OrbitProperties properties;
    private final StompHandshakeInterceptor handshakeInterceptor;
    private final CustomHandshakeHandler handshakeHandler;

    public WebSocketConfig(OrbitProperties properties,
                           StompHandshakeInterceptor handshakeInterceptor,
                           CustomHandshakeHandler handshakeHandler) {
        this.properties = properties;
        this.handshakeInterceptor = handshakeInterceptor;
        this.handshakeHandler = handshakeHandler;
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        String allowedOrigin = properties.cors().allowedOrigin();

        // Native WebSocket endpoint
        registry.addEndpoint("/ws")
                .setAllowedOrigins(allowedOrigin)
                .setHandshakeHandler(handshakeHandler)
                .addInterceptors(handshakeInterceptor);

        // SockJS fallback endpoint
        registry.addEndpoint("/ws")
                .setAllowedOrigins(allowedOrigin)
                .setHandshakeHandler(handshakeHandler)
                .addInterceptors(handshakeInterceptor)
                .withSockJS();
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry registry) {
        // Enable in-memory broker for public broadcasts (/topic) and user-specific queues (/queue)
        registry.enableSimpleBroker("/topic", "/queue")
                .setHeartbeatValue(new long[]{25000, 25000})
                .setTaskScheduler(stompHeartbeatTaskScheduler());

        // Inbound messages handled by @MessageMapping
        registry.setApplicationDestinationPrefixes("/app");

        // User destination prefix for targeted messaging (/user/queue/...)
        registry.setUserDestinationPrefix("/user");
    }

    @Bean
    public TaskScheduler stompHeartbeatTaskScheduler() {
        ThreadPoolTaskScheduler scheduler = new ThreadPoolTaskScheduler();
        scheduler.setPoolSize(1);
        scheduler.setThreadNamePrefix("ws-heartbeat-");
        scheduler.initialize();
        return scheduler;
    }
}
