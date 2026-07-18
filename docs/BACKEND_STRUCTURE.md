# Backend Project Structure

This document defines the exact package layout, class naming conventions, and file organisation for the Orbit Spring Boot monolith. It is the implementation-level reference to use alongside `docs/architecture/c3_component.md` when scaffolding and building the backend.

---

## Technology Stack Reference

- **Java 21**
- **Spring Boot 4.x**
- **Spring Web** — REST endpoints
- **Spring WebSocket + STOMP** — real-time messaging
- **Spring Security** — JWT filter chain
- **Spring Data MongoDB** — data access
- **Spring Kafka** — Kafka producer and consumer
- **Maven** — build tool

---

## Top-Level Project Layout

```
backend/
├── src/
│   ├── main/
│   │   ├── java/
│   │   │   └── com/
│   │   │       └── orbit/
│   │   │           ├── OrbitApplication.java
│   │   │           ├── auth/
│   │   │           ├── user/
│   │   │           ├── contact/
│   │   │           ├── group/
│   │   │           ├── conversation/
│   │   │           ├── message/
│   │   │           ├── websocket/
│   │   │           ├── presence/
│   │   │           ├── search/
│   │   │           ├── ai/
│   │   │           └── common/
│   │   └── resources/
│   │       ├── application.yml
│   │       ├── application-local.yml
│   │       └── application-prod.yml
│   └── test/
│       └── java/
│           └── com/
│               └── orbit/
│                   ├── auth/
│                   ├── message/
│                   └── ...          (mirrors main structure)
├── .env.example
├── .gitignore
├── docker-compose.yml
└── pom.xml
```

---

## Package Structure

Each feature package follows the same internal layout. The rule is simple: one package per domain, one class per responsibility within that package.

```
com.orbit.{feature}/
├── {Feature}Controller.java
├── {Feature}Service.java
├── {Feature}Repository.java        (where applicable)
├── dto/
│   ├── {Feature}Request.java       (inbound request bodies)
│   └── {Feature}Response.java      (outbound response bodies)
└── model/
    └── {Feature}.java              (MongoDB document model)
```

DTOs and models are kept separate. Models map to MongoDB documents and carry `@Document` annotations. DTOs carry validation annotations and shape the API contract — they are never persisted directly.

---

## Package Detail — auth

Handles registration, login, JWT issuance, refresh token rotation, and logout.

```
com.orbit.auth/
├── AuthController.java
├── AuthService.java
├── JwtService.java                 ← JWT generation, parsing, validation
├── TokenBlacklistService.java      ← access token blacklist (in-memory or Redis future)
├── dto/
│   ├── RegisterRequest.java
│   ├── LoginRequest.java
│   ├── RefreshRequest.java
│   ├── LogoutRequest.java
│   └── AuthResponse.java           ← returned on register/login/refresh
├── model/
│   └── RefreshToken.java           ← @Document, stores refresh token per session
├── filter/
│   └── JwtAuthenticationFilter.java ← Spring Security filter, validates JWT per request
└── config/
    └── SecurityConfig.java         ← SecurityFilterChain bean, CORS, permit rules
```

**Key rules:**
- `JwtService` is the single class that creates and parses JWTs — no other class imports JWT libraries directly
- `JwtAuthenticationFilter` validates the token and populates `SecurityContext` — nothing downstream re-validates
- `SecurityConfig` lives in `auth/config/` rather than a top-level `config/` package because it belongs to the auth domain

---

## Package Detail — user

Handles user profile management and avatar upload coordination.

```
com.orbit.user/
├── UserController.java
├── UserService.java
├── UserRepository.java
├── dto/
│   ├── UpdateProfileRequest.java
│   ├── UserProfileResponse.java    ← public profile shape (no email)
│   └── UserSearchResponse.java     ← search result shape with connectionStatus
└── model/
    └── User.java                   ← @Document("users")
```

**Key rules:**
- `UserController` resolves the authenticated user from `@AuthenticationPrincipal` — never from a request body
- Avatar upload is coordinated here but the actual R2 call goes through `common/storage/R2StorageClient`
- `UserRepository` is shared by `AuthService` for credential lookups — repositories are shared across packages when they access the same collection

---

## Package Detail — contact

Handles connection requests, contact list, and blocking.

```
com.orbit.contact/
├── ContactController.java
├── ContactService.java
├── ContactRepository.java
├── dto/
│   ├── SendRequestDto.java
│   ├── RespondRequestDto.java      ← action: ACCEPT | DECLINE
│   └── ContactResponse.java
└── model/
    └── Contact.java                ← @Document("contacts")
```

**Key rules:**
- `ContactService.acceptRequest()` calls `ConversationService.createDirectConversation()` — this cross-package call is intentional and documented in the ERD integrity checklist
- The call is wrapped in a MongoDB multi-document transaction
- `ContactService` exposes a block-status lookup that `MessageService` and `UserService` call on the message-send and profile-lookup paths respectively — this is the same cross-package pattern as the two calls above, just consumed by two additional packages. Full behavioral spec: `docs/discussions/007_blocking_behavior.md`.

---

## Package Detail — group

Handles group CRUD, membership, roles, invite tokens, and message pinning.

```
com.orbit.group/
├── GroupController.java
├── GroupService.java
├── GroupRepository.java
├── dto/
│   ├── CreateGroupRequest.java
│   ├── UpdateGroupRequest.java
│   ├── GroupResponse.java
│   ├── GroupMemberResponse.java
│   └── InviteResponse.java
└── model/
    └── Group.java                  ← @Document("groups"), embeds Member and PinnedMessage
```

**Key rules:**
- `GroupService.createGroup()` calls `ConversationService.createGroupConversation()` — same cross-package pattern as contact accept
- Admin promotion logic (promote longest-standing member when last admin leaves) lives in `GroupService` — not in a listener

---

## Package Detail — conversation

Handles conversation metadata, mute state, and the denormalised lastMessage snapshot.

```
com.orbit.conversation/
├── ConversationController.java
├── ConversationService.java
├── ConversationRepository.java
├── dto/
│   ├── ConversationResponse.java   ← includes lastMessage, unreadCount, muted
│   └── MuteRequest.java
└── model/
    └── Conversation.java           ← @Document("conversations"), embeds LastMessage
```

**Key rules:**
- `ConversationService` is called by `ContactService` and `GroupService` to create conversations atomically — it is the only place a conversation document is created
- `ConversationService.updateLastMessage()` is called by `MessageService` on every send — keeps the denormalised snapshot in sync

---

## Package Detail — message

The busiest package. Handles send, edit, soft delete, reactions, read receipts, and file upload coordination.

```
com.orbit.message/
├── MessageController.java
├── MessageService.java
├── MessageRepository.java
├── BlockedMessageRepository.java   ← @Document("blockedMessages"), separate from MessageRepository
├── dto/
│   ├── SendMessageRequest.java
│   ├── EditMessageRequest.java
│   ├── ReactionRequest.java
│   ├── MessageResponse.java        ← full message shape returned to clients
│   └── FileUploadResponse.java
└── model/
    ├── Message.java                ← @Document("messages"), embeds Reaction, ReadReceipt, QuotedMessage, File
    └── BlockedMessage.java         ← @Document("blockedMessages"), same embedded shape as Message minus ReadReceipt
```

**Key rules:**
- Persist to MongoDB BEFORE publishing to Kafka — always, without exception (see `docs/architecture/sequences/message_send_flow.md`)
- `MessageService.send()` calls: `MessageRepository.insert()` → `ConversationService.updateLastMessage()` → `NotificationService.upsertUnread()` → `KafkaProducerConfig.publish()` — in this exact order
- Reactions use `$pull` then `$push` via a custom repository method — never a simple `$push` which would allow duplicate reactions per user
- File upload calls `R2StorageClient.upload()` before inserting the message document — R2 must succeed first
- `MessageService.sendMessage()` checks block status (via `ContactService`) before persisting. If the sender is blocked by the recipient, the message is written via `BlockedMessageRepository` instead of `MessageRepository`, and the Kafka publish step is skipped entirely. See `docs/discussions/007_blocking_behavior.md`.
- `MessageService.editMessage()`, `deleteMessage()`, and `addReaction()` look up the target message in both `MessageRepository` and `BlockedMessageRepository` when locating by ID, since a blocked-out message will not be in `MessageRepository`
- `MessageService.getConversationHistory()` (and, in Phase 3, message search) merge results from both repositories, scoped to `senderId == requester` for `BlockedMessageRepository` — this scoping is the only filter needed to keep the recipient from ever seeing these documents

---

## Package Detail — websocket

Configures the STOMP broker, session registry, and WebSocket handshake interceptor.

```
com.orbit.websocket/
├── WebSocketConfig.java            ← @Configuration, implements WebSocketMessageBrokerConfigurer
├── WebSocketSessionRegistry.java   ← tracks active sessions per userId (multi-tab count)
├── StompHandshakeInterceptor.java  ← extracts JWT from ?token= on HTTP upgrade
└── KafkaWebSocketBridge.java       ← @KafkaListener on chat.messages and chat.presence,
                                       delivers events to local WebSocket sessions
```

**Key rules:**
- `WebSocketSessionRegistry` tracks session count per `userId` — online flag is set false only when count reaches zero (multi-tab safety)
- `StompHandshakeInterceptor` calls `JwtService.validateToken()` — the only place JWT is validated for WebSocket connections
- `KafkaWebSocketBridge` is the consumer side — it replaces the `KafkaConsumerConfig` name used in architecture docs. Both names refer to the same component

---

## Package Detail — presence

Handles online/offline state transitions and typing indicators.

```
com.orbit.presence/
├── PresenceService.java            ← handleConnect, handleDisconnect, handleTyping
└── dto/
    ├── PresenceEvent.java          ← { userId, online, lastSeen } — Kafka payload
    └── TypingEvent.java            ← { conversationId, userId, displayName, typing }
```

**Key rules:**
- `PresenceService` is called by `WebSocketConfig` via Spring's `@EventListener` on `SessionConnectEvent` and `SessionDisconnectEvent`
- Typing indicators never touch `UserRepository` — purely ephemeral Kafka publish
- `PresenceService` calls `KafkaProducerConfig` directly for both presence and typing events

---

## Package Detail — search

Handles user search, group discovery, and in-conversation message search.

```
com.orbit.search/
├── SearchController.java
├── SearchService.java
└── dto/
    └── SearchResponse.java
```

**Key rules:**
- `SearchService` calls `UserRepository`, `GroupRepository`, and `MessageRepository` directly — it is a read-only aggregator with no writes
- Message search uses MongoDB text indexes defined on `{ conversationId: 1, content: "text" }` — the index must exist before search works (created by `MigrationService` on startup)

---

## Package Detail — ai (Phase 4 only)

Entirely absent from the build in Phases 1–3. Do not create this package until Phase 4 begins.

```
com.orbit.ai/
├── AiController.java
├── AiService.java
├── ClaudeApiClient.java            ← single point of contact with Anthropic API
└── dto/
    ├── SummaryRequest.java
    ├── AskRequest.java
    ├── SuggestRepliesRequest.java
    ├── TranslateRequest.java
    ├── ToneCheckRequest.java
    └── AiResponse.java             ← generic wrapper, feature-specific fields
```

**Key rules:**
- `ClaudeApiClient` is the only class that imports Anthropic SDK or makes HTTPS calls to `api.anthropic.com`
- `AiService` calls `MessageRepository` for context reads — it never writes messages directly, it calls `MessageService.insertBotMessage()` for bot message persistence
- All five features route through `ClaudeApiClient` — one place to update model, timeout, and API version

---

## Package Detail — common

Cross-cutting utilities and infrastructure beans shared across feature packages.

```
com.orbit.common/
├── exception/
│   ├── GlobalExceptionHandler.java ← @RestControllerAdvice, consistent error envelope
│   ├── AiServiceException.java
│   ├── ResourceNotFoundException.java
│   ├── ConflictException.java
│   └── RateLimitException.java
├── filter/
│   └── RateLimitFilter.java        ← token bucket per userId per endpoint group
├── kafka/
│   └── KafkaProducerConfig.java    ← producer bean, publishes to all three topics
├── storage/
│   └── R2StorageClient.java        ← AWS S3 SDK wrapper for Cloudflare R2
├── migration/
│   └── MigrationService.java       ← runs MongoDB schema validators + indexes on startup
├── init/
│   └── DataInitializer.java        ← seeds BOT_USER_ID on startup (Phase 4 dependency)
└── config/
    └── MongoConfig.java            ← MongoDB connection, transaction manager bean
```

**Key rules:**
- `GlobalExceptionHandler` is the single place that converts exceptions to HTTP responses — controllers never have try-catch blocks
- `KafkaProducerConfig` is one bean used by `MessageService`, `PresenceService`, and `AiService` — not three separate producer classes
- `MigrationService` runs `@PostConstruct` and is idempotent — safe to run on every startup
- `DataInitializer` seeds the `BOT_USER_ID` system user and is also idempotent — skips if already present

---

## application.yml Structure

```yaml
spring:
  data:
    mongodb:
      uri: ${MONGODB_URI}
      database: orbit

  kafka:
    bootstrap-servers: ${KAFKA_BOOTSTRAP_SERVERS}
    producer:
      key-serializer: org.apache.kafka.common.serialization.StringSerializer
      value-serializer: org.springframework.kafka.support.serializer.JsonSerializer
      retries: 3
    consumer:
      group-id: orbit-backend
      auto-offset-reset: earliest
      key-deserializer: org.apache.kafka.common.serialization.StringDeserializer
      value-deserializer: org.springframework.kafka.support.serializer.JsonDeserializer

server:
  port: ${SERVER_PORT:8080}

orbit:
  jwt:
    secret: ${JWT_SECRET}
    access-token-expiry-ms: ${JWT_ACCESS_TOKEN_EXPIRY_MS:900000}
    refresh-token-expiry-ms: ${JWT_REFRESH_TOKEN_EXPIRY_MS:604800000}
  r2:
    account-id: ${R2_ACCOUNT_ID}
    access-key-id: ${R2_ACCESS_KEY_ID}
    secret-access-key: ${R2_SECRET_ACCESS_KEY}
    bucket-name: ${R2_BUCKET_NAME}
    public-url: ${R2_PUBLIC_URL}
  anthropic:
    api-key: ${ANTHROPIC_API_KEY}
    model: claude-sonnet-4-6
    timeout-seconds: 30
  rate-limit:
    messages-per-minute: 60
    ai-requests-per-minute: 20
    default-per-minute: 100
```

Custom `orbit.*` properties are bound via `@ConfigurationProperties` beans in the relevant packages — no `@Value` annotations scattered across the codebase.

---

## Naming Conventions

| Type            | Convention                 | Example                    |
|-----------------|----------------------------|----------------------------|
| Controller      | `{Feature}Controller`      | `MessageController`        |
| Service         | `{Feature}Service`         | `MessageService`           |
| Repository      | `{Feature}Repository`      | `MessageRepository`        |
| Document model  | Singular noun              | `Message`, `User`, `Group` |
| Request DTO     | `{Action}{Feature}Request` | `SendMessageRequest`       |
| Response DTO    | `{Feature}Response`        | `MessageResponse`          |
| Kafka event DTO | `{Feature}Event`           | `PresenceEvent`            |
| Config class    | `{Feature}Config`          | `SecurityConfig`           |
| Filter class    | `{Feature}Filter`          | `RateLimitFilter`          |
| Exception class | `{Condition}Exception`     | `RateLimitException`       |

---

## Layer Rules (Summary)

These are enforced by convention — not by the framework — so they must be followed consciously:

- **Controllers** call their matching service only. No repository access, no business logic, no try-catch blocks.
- **Services** own all business logic and transactional boundaries. May call other services for cross-domain operations. Call repositories directly.
- **Repositories** are data access only. No business logic. Never call other repositories.
- **Transactions** are initiated in service methods only, never in controllers.
- **JWT validation** happens once in `JwtAuthenticationFilter`. No downstream re-validation.
- **Kafka publish** happens after MongoDB persist — always, without exception.
- **R2 upload** happens before message document creation — always, without exception.
