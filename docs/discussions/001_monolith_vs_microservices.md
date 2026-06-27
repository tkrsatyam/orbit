# 001 — Monolith vs Microservices

> **Format:** Architecture Decision Record (ADR)
> **Reference:** https://adr.github.io
> **Date:** 2026-06-27
> **Status:** Accepted

---

## Context

When planning Orbit's backend architecture, the first structural
decision was whether to follow a microservices pattern or build
a modular monolith.

The team has prior experience building a microservices architecture
in a separate project (a job application tracker) using Spring Cloud
Gateway, Netflix Eureka, and multiple independently deployed Spring
Boot services. That experience surfaced real operational pain points
around service coordination, version compatibility, and deployment
complexity on free-tier infrastructure.

Orbit's backend needs to handle:
- WebSocket connections for real-time messaging
- REST endpoints for resource management
- Kafka integration for WebSocket fan-out
- File storage integration
- AI API integration (Phase 4)

The question was whether these responsibilities warranted separate
services or could be cleanly handled inside one deployable unit.

---

## Options Considered

### Option 1 — Microservices
Separate deployable Spring Boot services per domain
(auth, messaging, groups, files, notifications, AI).

**Pros:**
- Independent scaling per service
- Failure isolation between domains
- Technology flexibility per service
- Mirrors enterprise production patterns

**Cons:**
- Each free-tier deployment slot consumed by one service
- Spring Cloud Gateway and Eureka required for routing and discovery
- Version compatibility issues between Spring Cloud and Spring Boot
  (experienced firsthand in prior project)
- WebSocket fan-out across services requires a message broker
  regardless of architecture choice
- Operational overhead disproportionate to project scale
- Slows development velocity significantly for a solo developer

### Option 2 — Modular Monolith (Chosen)
One Spring Boot application organised into clean feature packages
internally, deployed as a single JAR.

**Pros:**
- Single deployment unit — one Render free-tier slot
- No Spring Cloud dependency — eliminates version compatibility risk
- Clean package boundaries still enforce separation of concerns
- WebSocket sessions managed in one place — no cross-instance
  session problem within a single deployment
- Faster development velocity
- Easier local development and debugging
- Kafka still used for fan-out if multiple instances are needed

**Cons:**
- Cannot scale individual features independently
- A critical bug can affect the entire application
- Tech stack is uniform across all features
- Harder to extract into services later if requirements change
  significantly (mitigated by clean package boundaries)

---

## Decision

Orbit uses a **modular monolith** backend architecture.

One Spring Boot 4.x application handles all backend responsibilities,
organised into the following internal packages:

```
com.orbit
├── auth/
├── user/
├── group/
├── conversation/
├── message/
├── websocket/
├── presence/
├── file/
├── search/
└── ai/
```

Each package owns its own controllers, services, repositories,
and models. Cross-package dependencies are minimised and always
go through service interfaces, never directly between repositories.

This project's responsibility is to demonstrate WebSocket
architecture, real-time systems, React, and AI integration.
Microservices complexity would obscure those demonstrations
without adding meaningful value.

The prior project (job application tracker) already demonstrates
microservices architecture with Spring Cloud Gateway, Eureka,
and Kafka. There is no resume value in repeating the same
architectural pattern.

---

## Drawbacks Acknowledged

- No independent scaling per feature domain
- Single point of failure for the entire backend
- Uniform technology stack across all concerns
- Migration to microservices later would require significant
  refactoring, though clean package boundaries reduce this cost

---

## Evolution Path

If Orbit were to grow beyond portfolio scale:

1. **Horizontal scaling first** — run multiple instances of the
   monolith behind a load balancer. Kafka already handles
   WebSocket fan-out across instances. No code changes required.

2. **Extract high-load domains** — if message volume becomes
   the bottleneck, the messaging package is the natural first
   extraction candidate. Clean package boundaries mean this
   extraction is scoped and predictable.

3. **Full microservices** — only justified if multiple teams
   need to own independent deployment pipelines. Not applicable
   at current scale.

---

## References

- Discord Engineering Blog — "How Discord Stores Billions of Messages"
  (documents their monolith-first, selective extraction journey)
- Martin Fowler — "MonolithFirst" pattern
  https://martinfowler.com/bliki/MonolithFirst.html
- Prior project experience with Spring Cloud Gateway 2025.x
  programmatic RouterFunction bean requirements