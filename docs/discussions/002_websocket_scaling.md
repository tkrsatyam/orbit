# 002 — WebSocket Scaling and Kafka Fan-out

> **Format:** Architecture Decision Record (ADR)  
> **Reference:** https://adr.github.io  
> **Date:** 2026-06-27  
> **Status:** Accepted  

---

## Context

Orbit's core value proposition is real-time messaging. This is delivered via WebSockets — persistent, bidirectional connections between each client and the backend server.  

When planning for horizontal scaling (running multiple instances of the Spring Boot monolith behind a load balancer), a fundamental problem emerges: WebSocket sessions are in-memory and instance-specific.  

### The Multi-Instance Problem

When a user connects via WebSocket, their session is held in the memory of whichever instance accepted the connection. If another user sends them a message and that request is routed to a different instance, that instance has no knowledge of the recipient's session and cannot deliver the message.  

```
User A  ←——WebSocket——→  Instance 1  (session lives here)
User B  ——sends message→  Instance 2  (no knowledge of User A)
↓
Message never reaches User A ❌
```

This problem must be solved before horizontal scaling is possible.

Two solutions were evaluated: Redis Pub/Sub and Apache Kafka.

---

## Options Considered

### Option 1 — Redis Pub/Sub

Every instance subscribes to a Redis channel on startup. When any instance receives a message, it publishes to the Redis channel. All instances receive it and deliver to any WebSocket sessions they hold.  

**Pros:**
- Lightweight and simple to implement
- Low latency — sub-millisecond delivery
- Spring Boot has native Redis Pub/Sub support

**Cons:**
- Fire-and-forget — if no subscriber is listening at the moment of publish, the message is permanently lost  
- No message persistence — if an instance restarts mid-delivery, in-flight messages are gone  
- No replay capability — cannot recover missed messages after a connection drop or restart  
- At-most-once delivery guarantee

### Option 2 — Apache Kafka (Chosen)

Every instance produces to and consumes from Kafka topics. Messages are persisted to disk by Kafka. Each instance consumes from the topic and delivers to any WebSocket sessions it holds for relevant recipients.  

**Pros:**
- Messages persisted to disk — survives instance restarts
- At-least-once delivery guarantee
- Replay capability — can reprocess from a given offset
- Consumer groups allow selective processing per instance
- Same technology already used in prior project — no new learning overhead  
- Upstash Kafka available on free tier for production

**Cons:**
- Higher operational complexity than Redis Pub/Sub
- Small latency overhead (typically 10â€“50ms) compared to direct WebSocket delivery or Redis — imperceptible to users in a chat context  
- Heavier infrastructure locally (requires Docker)

---

## Decision

Orbit uses **Apache Kafka** for WebSocket fan-out across backend instances.  

### Kafka Topics

```
chat.messages       ← new messages to broadcast to recipients
chat.presence       ← typing indicators and online/offline events
chat.notifications  ← unread counts and mention alerts (Phase 2)
```

### Message Flow

```
1. User sends message via WebSocket
2. Instance receives it
3. Message persisted to MongoDB immediately
4. Instance publishes event to Kafka topic: chat.messages
5. All instances consume the event
6. Each instance checks: do I hold a WebSocket session for any recipient of this message?
7. If yes → deliver via WebSocket
8. If no → discard event
```

### Presence and Typing Events

Typing indicators and presence events are ephemeral — they do not need persistence. The `chat.presence` topic is configured with a short retention period (minutes) to reflect this.  

### Single Instance Behaviour

In development and single-instance production deployment, Kafka still operates but fan-out is trivially resolved — the single instance holds all sessions and delivers all messages. No special-casing required.  

---

## Drawbacks Acknowledged

- Kafka adds infrastructure complexity to local development
  (Docker Compose required)
- 10–50ms additional latency per message compared to direct
  in-memory delivery — acceptable for chat, imperceptible to users
- Upstash Kafka free tier has message and throughput limits — acceptable for portfolio scale, would need a paid plan for production traffic  

---

## Evolution Path

The current architecture is horizontally scalable from day one.

Scaling steps:

1. **Add instances** — deploy additional Render instances behind a load balancer. No code changes required. Kafka fan-out handles session routing automatically.  

2. **Partition by conversation** — at high message volume, partition the `chat.messages` topic by conversationId so instances can consume only the partitions relevant to the sessions they hold. Reduces unnecessary event processing.  

3. **Dedicated Kafka cluster** — replace Upstash with a managed Confluent or MSK cluster if throughput limits are reached.  

---

## References

- Apache Kafka Documentation — https://kafka.apache.org/documentation
- Upstash Kafka — https://upstash.com/kafka
- Spring for Apache Kafka — https://spring.io/projects/spring-kafka
- Discord Engineering — WebSocket infrastructure at scale