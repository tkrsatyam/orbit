# Backend Review Guidelines (Orbit Monolith)

Review any changes in `backend/` against these architectural and code quality rules:

## Technology Stack & Architecture
- **Language & Runtime**: Java 25 and Spring Boot.
- **Architectural Style**: Monolith. **Strict: No Spring Cloud**. Flag any Spring Cloud annotations or dependencies (e.g., `@EnableEurekaClient`, Feign, Ribbon, Cloud Config).
- **Persistence**: MongoDB (Atlas).
  - Verify document references, indexing considerations, and transactional boundaries.
  - Watch for unbounded queries, accidental collection scans, or missing pagination.
- **Messaging**: Upstash Kafka used for WebSocket fan-out and event distribution. Ensure payload serializability and idempotency in event listeners.

## API & Error Handling
- REST APIs must adhere to standard HTTP status codes (`200 OK`, `201 Created`, `400 Bad Request`, `401 Unauthorized`, `403 Forbidden`, `404 Not Found`, `409 Conflict`).
- Ensure all exceptions are routed through the standardized global error envelope.
- Strictly flag empty `catch` blocks or swallowed exceptions.

## System Invariants & Framework Guarantees (Do Not Flag)
- **Configuration Invariant**: `OrbitProperties` is strictly typed, records are annotated with `@NotNull` and `@NotBlank`, and Spring `@Validated` halts startup if configuration is missing. **Do not flag missing null-checks, default fallbacks, or NPE risks on validated configuration beans**.
- **Error Handling Invariant**: `GlobalExceptionHandler` intercepts all unhandled exceptions and converts them into standardized RFC 7807 global error envelopes. Controllers and services do not need redundant defensive `try-catch` blocks around standard operations.
- **Authentication Invariant**: JWT access tokens are validated once per HTTP request or during WebSocket upgrade. Internal service methods trust the populated `SecurityContext` / `Principal`.

## Security & Resilience
- Never hardcode credentials, API keys, or secrets.
- Verify authorization checks on every state-mutating endpoint. Ensure users cannot modify or access entities belonging to other tenants or users without permission.
- Ensure input validation annotations (`@Valid`, `@NotNull`, `@NotBlank`, `@Size`) are applied to incoming request DTOs.
- Avoid resource leaks. Ensure streams, connections, and external resources are safely managed (try-with-resources).
