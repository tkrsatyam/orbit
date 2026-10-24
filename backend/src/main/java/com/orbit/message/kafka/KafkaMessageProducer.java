package com.orbit.message.kafka;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Component;

/**
 * Publishes MessageDeliveryEvents to Kafka topic 'chat.messages' for multi-instance WebSocket fan-out.
 * Keyed by conversationId to guarantee in-order delivery within a conversation partition.
 */
@Component
public class KafkaMessageProducer {

    private static final Logger log = LoggerFactory.getLogger(KafkaMessageProducer.class);
    public static final String CHAT_MESSAGES_TOPIC = "chat.messages";

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
}
