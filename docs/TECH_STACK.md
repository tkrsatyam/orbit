# Tech Stack

This document covers every technology decision in Orbit, with justification for each choice. Deeper architectural decisions are documented as ADRs in [`discussions/`](./discussions/).

---

## Frontend

### React
- **What:** UI library for building component-based interfaces
- **Why:** Most listed frontend requirement in target job descriptions.
  The developer has production Angular experience — React adds demonstrated framework flexibility to the resume. Conceptually close to Angular signals, reducing the learning curve.
- **Version:** Confirm from `package.json` after Vite scaffold
- **ADR Reference:** [`discussions/003_frontend_framework.md`](./discussions/003_frontend_framework.md)

### Vite
- **What:** Frontend build tool and dev server
- **Why:** Fastest development experience for React projects. Near-instant hot module replacement. Zero configuration to get started. Industry standard for new React projects in 2025+, replacing Create React App.

### React Router
- **What:** Client-side routing library for React
- **Why:** Standard routing solution for React SPAs. Handles protected routes, navigation, and URL-based view rendering.

### SockJS + STOMP.js
- **What:** WebSocket client libraries
- **Why:** SockJS provides WebSocket with automatic fallback to HTTP long-polling if WebSocket is unavailable in the browser or network environment. STOMP is a messaging protocol that runs over WebSocket, providing named destinations (topics and queues) rather than raw socket frames. Spring Boot's WebSocket support is built around STOMP — using it on the client ensures compatibility with the backend out of the box.

### Axios
- **What:** HTTP client for REST API calls
- **Why:** Cleaner API than the native Fetch API. Supports request and response interceptors — used for attaching JWT access tokens to outgoing requests and handling 401 responses for token refresh automatically.

---

## Backend

### Spring Boot 4.x
- **What:** Java framework for building production-ready backend applications
- **Why:** Primary backend framework with production experience from the companion portfolio project (JobTrackr). Version 4.x is the current stable generation built on Spring Framework 7, with Java 21 support and a modularised codebase.
- **Version:** Confirm from `pom.xml` after project initialisation
- **Java Version:** 21 (current LTS)
- **No Spring Cloud:** Spring Cloud is explicitly excluded. It solves distributed systems problems (service discovery, gateway routing, centralised config) that do not exist in a monolithic architecture. Its inclusion would add version compatibility risk with no benefit.  
 See [`discussions/001_monolith_vs_microservices.md`](./discussions/001_monolith_vs_microservices.md)

### Spring WebSocket + STOMP
- **What:** Spring's WebSocket support with STOMP messaging protocol
- **Why:** Native Spring Boot integration. STOMP over WebSocket provides named channel subscriptions, message routing, and broadcast destinations — exactly what a chat application needs. Works with SockJS on the client side seamlessly.

### Spring Security + JWT
- **What:** Authentication and authorisation framework
- **Why:** Industry standard for Spring Boot security. JWT-based stateless auth means the backend does not need session storage. Access tokens (15 min) keep the attack window small. Refresh tokens (7 days) maintain user sessions without repeated logins. BCrypt cost factor 12 for password hashing.
- **Identity propagation:** JWT is validated once at the entry point (Spring Security filter chain). Downstream internal package calls receive identity via a SecurityContext holder — no re-validation of the token at the service or repository layer. This is the production standard pattern: authenticate at the boundary, trust internally.

### Spring Data MongoDB
- **What:** Spring's data access layer for MongoDB
- **Why:** Provides repository abstractions, query methods, and aggregation pipeline support for MongoDB. Eliminates boilerplate data access code. Consistent with Spring Boot's auto-configuration model. Replaces Spring Data JPA — no relational database is used in Orbit.

### Spring Kafka
- **What:** Spring's integration with Apache Kafka
- **Why:** Used for WebSocket fan-out across multiple backend instances. When a message is sent, it is published to a Kafka topic. All running instances consume from the topic and deliver to any WebSocket sessions they hold. This makes the architecture horizontally scalable without microservices.  
 See [`discussions/002_websocket_scaling.md`](./discussions/002_websocket_scaling.md)

---

## Database

### MongoDB
- **What:** Document-oriented NoSQL database
- **Why:** Single database for all data domains — users, contacts, groups, conversations, messages, notifications.
  Messages and their nested reactions and read receipts are naturally document-shaped. Schema flexibility allows new message types and fields without migrations. Write-optimised for high-volume message inserts. Referential integrity enforced at the application service layer, consistent with how production enterprise systems operate MongoDB at scale.
- **Local:** Docker (MongoDB image)
- **Production:** MongoDB Atlas free tier
- **ADR Reference:** [`discussions/005_database_strategy.md`](./discussions/005_database_strategy.md)

### Kafka Topics

```
chat.messages       ← message fan-out to WebSocket sessions (Phase 1)
chat.presence       ← typing indicators, online/offline events (Phase 1)
chat.notifications  ← real-time push of unread-count/mention changes to already-connected clients (Phase 2 only).
                      Phase 1 computes and stores unreadCount directly in MongoDB with no Kafka involvement — see
                      message_send_flow.md.
```

---

## Storage

### Cloudflare R2
- **What:** S3-compatible object storage
- **Why:** Zero egress fees compared to AWS S3. Free tier covers portfolio-scale usage. S3-compatible API means the Java AWS SDK works without modification. Used for user avatars, group images, and file/image message attachments (Phase 2 and Phase 3).

---

## AI

### Claude API (Anthropic)
- **What:** Large language model API
- **Why:** Powers all Phase 4 AI features. Stateless HTTP calls — message context is passed in, response returned. No vector databases, no fine-tuning, no additional infrastructure required. The AI service layer in the backend is a clean internal package making calls to the Anthropic API.
- **Model:** claude-sonnet-4-6
- **Phase:** 4 only — not used in Phases 1–3
- **Note:** Server-side message processing required for all AI features. This is the reason E2EE is not implemented. See [`discussions/004_e2ee_vs_ai_features.md`](./discussions/004_e2ee_vs_ai_features.md)

---

## Infrastructure

### Vercel
- **What:** Frontend hosting platform
- **Why:** Zero configuration deployment for React/Vite projects. Free tier covers portfolio needs. Native GitHub integration available but intentionally disabled for auto-deploys.
- **CI/CD Note:** Vercel's automatic Git deployment is disabled via `git.deploymentEnabled: false` in `vercel.json`. Deployments are triggered exclusively through the GitHub Actions pipeline via Vercel Deploy Hook. This ensures the frontend only deploys after the CI pipeline passes — not on every push to main (which might have purely backend changes only). Without this, Vercel and GitHub Actions both attempt to deploy simultaneously, causing race conditions and redundant builds.
- **Already solved in companion project (JobTrackr):** same pattern, same fix.

### Render
- **What:** Backend hosting platform
- **Why:** Free tier supports a single Spring Boot instance with sufficient memory. Simple Docker-based deployment. No Spring Cloud or service mesh required. Already used in the companion portfolio project.

### MongoDB Atlas
- **What:** Managed MongoDB hosting
- **Why:** Free tier (M0) provides 512MB storage — sufficient for portfolio scale. Encryption at rest included. Automated backups. No infrastructure management required.

### Upstash Kafka
- **What:** Managed Kafka hosting
- **Why:** Serverless Kafka on the free tier. REST and native Kafka protocol supported. Already used in the companion portfolio project. No Kafka cluster to manage locally in CI or production.

### Cloudflare R2
- Listed under Storage above.

### GitHub Actions
- **What:** CI/CD pipeline
- **Why:** Native GitHub integration. Path-based filtering triggers frontend and backend pipelines independently — a backend change does not trigger a frontend build and vice versa. Same monorepo CI/CD pattern used in the companion portfolio project.

---

## Development Tools

### Docker Compose
- **What:** Local multi-container orchestration
- **Why:** Runs MongoDB and Kafka locally without installing them directly on the development machine. Single `docker compose up -d` starts all local infrastructure dependencies.

### Maven
- **What:** Java build tool
- **Why:** Standard for Spring Boot projects. Spring Initializr generates Maven projects by default. `./mvnw` wrapper committed to the repo so no local Maven installation is required.

---

## Decisions Documented as ADRs

| Decision                     | File                                                                                             |
|------------------------------|--------------------------------------------------------------------------------------------------|
| Monolith vs microservices    | [`discussions/001_monolith_vs_microservices.md`](./discussions/001_monolith_vs_microservices.md) |
| WebSocket scaling with Kafka | [`discussions/002_websocket_scaling.md`](./discussions/002_websocket_scaling.md)                 |
| Frontend framework selection | [`discussions/003_frontend_framework.md`](./discussions/003_frontend_framework.md)               |
| E2EE vs AI features          | [`discussions/004_e2ee_vs_ai_features.md`](./discussions/004_e2ee_vs_ai_features.md)             |
| Database strategy            | [`discussions/005_database_strategy.md`](./discussions/005_database_strategy.md)                 |
| Contact removal strategy     | [`discussions/006_contact_removal_strategy.md`](./discussions/006_contact_removal_strategy.md)   |