package com.orbit.message.kafka;

import com.orbit.message.dto.ReactionResponse;

import java.util.List;

public record MessageReactionEvent(
        String conversationId,
        String messageId,
        List<ReactionResponse> reactions
) {}
