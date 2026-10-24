package com.orbit.message.model;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Delivery status of a message")
public enum MessageDeliveryStatus {
    SENDING,
    SENT,
    DELIVERED,
    READ,
    FAILED
}
