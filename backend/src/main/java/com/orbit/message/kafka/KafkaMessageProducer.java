package com.orbit.message.kafka;

import com.orbit.notification.dto.NotificationEvent;
import com.orbit.presence.dto.PresenceEvent;
import com.orbit.presence.dto.TypingEvent;
import io.github.springwolf.bindings.kafka.annotations.KafkaAsyncOperationBinding;
import io.github.springwolf.core.asyncapi.annotations.AsyncOperation;
import io.github.springwolf.core.asyncapi.annotations.AsyncPublisher;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

/**
 * Publishes MessageDeliveryEvents, ReadReceipts, and Presence/Typing to Kafka topics for multi-instance WebSocket fan-out.
 */
@Component
public class KafkaMessageProducer {

    private static final Logger log = LoggerFactory.getLogger(KafkaMessageProducer.class);
    public static final String CHAT_MESSAGES_TOPIC = "chat.messages";
    public static final String CHAT_MESSAGES_EDITED_TOPIC = "chat.messages.edited";
    public static final String CHAT_MESSAGES_DELETED_TOPIC = "chat.messages.deleted";
    public static final String CHAT_MESSAGES_READ_TOPIC = "chat.messages.read";
    public static final String CHAT_PRESENCE_TOPIC = "chat.presence";
    public static final String CHAT_NOTIFICATIONS_TOPIC = "chat.notifications";

    private final KafkaTemplate<String, Object> kafkaTemplate;

    public KafkaMessageProducer(KafkaTemplate<String, Object> kafkaTemplate) {
        this.kafkaTemplate = kafkaTemplate;
    }

    /**
     * Publishes a message event to Kafka.
     * Follows E2 resilience pattern from message_send_flow.md: failures are logged,
     * but do not fail the sender receipt since MongoDB persistence already succeeded.
     *
     * @param event the delivery event
     */
    @AsyncPublisher(
            operation = @AsyncOperation(
                    channelName = CHAT_MESSAGES_TOPIC,
                    description = "Publishes saved messages to Kafka chat.messages topic for multi-instance fan-out.",
                    payloadType = MessageDeliveryEvent.class
            )
    )
    @KafkaAsyncOperationBinding
    public void publishMessage(MessageDeliveryEvent event) {
        try {
            kafkaTemplate.send(CHAT_MESSAGES_TOPIC, event.conversationId(), event);
            log.debug("Published message delivery event to Kafka: messageId={}, conversationId={}",
                    event.messageId(), event.conversationId());
        } catch (Exception e) {
            log.error("Failed to publish message delivery event to Kafka for messageId={}: {}",
                    event.messageId(), e.getMessage(), e);
        }
    }

    /**
     * Publishes a message edited event to Kafka.
     *
     * @param event the edit event
     */
    @AsyncPublisher(
            operation = @AsyncOperation(
                    channelName = CHAT_MESSAGES_EDITED_TOPIC,
                    description = "Publishes edited message events to Kafka chat.messages.edited topic for multi-instance fan-out.",
                    payloadType = MessageEditedEvent.class
            )
    )
    @KafkaAsyncOperationBinding
    public void publishMessageEdited(MessageEditedEvent event) {
        try {
            kafkaTemplate.send(CHAT_MESSAGES_EDITED_TOPIC, event.conversationId(), event);
            log.debug("Published message edited event to Kafka: messageId={}, conversationId={}",
                    event.messageId(), event.conversationId());
        } catch (Exception e) {
            log.error("Failed to publish message edited event to Kafka for messageId={}: {}",
                    event.messageId(), e.getMessage(), e);
        }
    }

    /**
     * Publishes a message deleted event to Kafka.
     *
     * @param event the delete event
     */
    @AsyncPublisher(
            operation = @AsyncOperation(
                    channelName = CHAT_MESSAGES_DELETED_TOPIC,
                    description = "Publishes deleted message events to Kafka chat.messages.deleted topic for multi-instance fan-out.",
                    payloadType = MessageDeletedEvent.class
            )
    )
    @KafkaAsyncOperationBinding
    public void publishMessageDeleted(MessageDeletedEvent event) {
        try {
            kafkaTemplate.send(CHAT_MESSAGES_DELETED_TOPIC, event.conversationId(), event);
            log.debug("Published message deleted event to Kafka: messageId={}, conversationId={}",
                    event.messageId(), event.conversationId());
        } catch (Exception e) {
            log.error("Failed to publish message deleted event to Kafka for messageId={}: {}",
                    event.messageId(), e.getMessage(), e);
        }
    }

    /**
     * Publishes a message read event to Kafka topic 'chat.messages.read'.
     *
     * @param event the read event
     */
    @AsyncPublisher(
            operation = @AsyncOperation(
                    channelName = CHAT_MESSAGES_READ_TOPIC,
                    description = "Publishes read receipt events to Kafka chat.messages.read topic for multi-instance fan-out.",
                    payloadType = MessageReadEvent.class
            )
    )
    @KafkaAsyncOperationBinding
    public void publishMessageRead(MessageReadEvent event) {
        try {
            kafkaTemplate.send(CHAT_MESSAGES_READ_TOPIC, event.conversationId(), event);
            log.debug("Published message read event to Kafka: messageId={}, conversationId={}, userId={}",
                    event.messageId(), event.conversationId(), event.userId());
        } catch (Exception e) {
            log.error("Failed to publish message read event to Kafka for messageId={}, userId={}: {}",
                    event.messageId(), event.userId(), e.getMessage(), e);
        }
    }

    /**
     * Publishes a typing event to Kafka topic 'chat.presence'.
     *
     * @param event the typing event
     */
    @AsyncPublisher(
            operation = @AsyncOperation(
                    channelName = CHAT_PRESENCE_TOPIC,
                    description = "Publishes typing events to Kafka chat.presence topic for multi-instance fan-out.",
                    payloadType = TypingEvent.class
            )
    )
    @KafkaAsyncOperationBinding
    public void publishTyping(TypingEvent event) {
        try {
            kafkaTemplate.send(CHAT_PRESENCE_TOPIC, event.conversationId(), event);
            log.debug("Published typing event to Kafka: conversationId={}, userId={}, typing={}",
                    event.conversationId(), event.userId(), event.typing());
        } catch (Exception e) {
            log.error("Failed to publish typing event to Kafka for conversationId={}, userId={}: {}",
                    event.conversationId(), event.userId(), e.getMessage(), e);
        }
    }

    /**
     * Publishes a presence event to Kafka topic 'chat.presence'.
     *
     * @param event the presence event
     */
    @AsyncPublisher(
            operation = @AsyncOperation(
                    channelName = CHAT_PRESENCE_TOPIC,
                    description = "Publishes user presence online/offline status events to Kafka chat.presence topic.",
                    payloadType = PresenceEvent.class
            )
    )
    @KafkaAsyncOperationBinding
    public void publishPresence(PresenceEvent event) {
        try {
            kafkaTemplate.send(CHAT_PRESENCE_TOPIC, event.userId(), event);
            log.debug("Published presence event to Kafka: userId={}, online={}",
                    event.userId(), event.online());
        } catch (Exception e) {
            log.error("Failed to publish presence event to Kafka for userId={}: {}",
                    event.userId(), e.getMessage(), e);
        }
    }

    /**
     * Publishes a personal notification event to Kafka topic 'chat.notifications'.
     *
     * @param event the notification event
     */
    @AsyncPublisher(
            operation = @AsyncOperation(
                    channelName = CHAT_NOTIFICATIONS_TOPIC,
                    description = "Publishes personal notifications to Kafka chat.notifications topic for multi-instance fan-out.",
                    payloadType = NotificationEvent.class
            )
    )
    @KafkaAsyncOperationBinding
    public void publishNotification(NotificationEvent event) {
        try {
            kafkaTemplate.send(CHAT_NOTIFICATIONS_TOPIC, event.userId(), event);
            log.debug("Published notification event to Kafka: userId={}, type={}",
                    event.userId(), event.payload() != null ? event.payload().type() : null);
        } catch (Exception e) {
            log.error("Failed to publish notification event to Kafka for userId={}: {}",
                    event.userId(), e.getMessage(), e);
        }
    }
}

