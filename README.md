# Orbit 💬

A real-time chat application for people who connect over shared goals — career switchers, interview preppers, learners, and builders.

Built with React and Spring Boot, powered by WebSockets and Kafka, with AI-assisted group communication planned for a future phase.

---

## Live Demo

> Coming soon — will be updated once deployed.

---

## Features

### Phase 1 — Core (In Progress)
- Email and password authentication with JWT
- 1:1 Direct Messaging with real-time delivery
- Group chats organised around shared interests and goals
- Public group discovery by topic
- Online/offline presence indicators
- Typing indicators

### Phase 2 — Enhancement
- Emoji reactions on messages
- Quoted replies
- Unread message badges
- Browser desktop notifications
- User avatar and group image uploads

### Phase 3 — Search & Files
- User and group search
- In-conversation message search
- Image and file sharing

### Phase 4 — AI Features (Planned)
- `/summary` — catch up on missed group conversations instantly
- `@ask` — collaborative AI assistant, answers visible to the whole group
- Smart reply suggestions
- Message translation
- Tone checker before sending

---

## Tech Stack

### Frontend
| Technology | Purpose |
|---|---|
| React 19 | UI framework |
| React Router | Client-side navigation |
| SockJS + STOMP | WebSocket client |
| Axios | HTTP client |
| Vite | Build tool |

### Backend
| Technology | Purpose |
|---|---|
| Spring Boot 4.x | Modular monolithic backend |
| Spring WebSocket + STOMP | Real-time messaging |
| Spring Security + JWT | Authentication |
| Spring Data MongoDB | Data access layer |
| Apache Kafka | WebSocket fan-out across instances |
| Cloudflare R2 | File and image storage |
| Claude API (Anthropic) | AI features (Phase 4) |

### Database
| Technology | Purpose |
|---|---|
| MongoDB | All persistent data — users, groups, conversations, messages |

### Infrastructure
| Service | Purpose |
|---|---|
| Vercel | React frontend hosting |
| Render | Spring Boot backend hosting |
| MongoDB Atlas | Managed MongoDB (free tier) |
| Upstash | Managed Kafka |
| Cloudflare R2 | Object storage |
| GitHub Actions | CI/CD pipeline |

---

## Architecture

Orbit uses a **monorepo** structure with a **modular monolithic** backend.

```
orbit/
├── frontend/     # React SPA — deployed on Vercel
├── backend/      # Spring Boot monolith — deployed on Render
└── docs/         # Architecture decisions, ERD, API contracts
```

The backend is organised into feature packages internally (auth, user, group, conversation, message, websocket, presence, file, search, ai) rather than separate deployable services. Kafka handles WebSocket fan-out across multiple backend instances, making the architecture horizontally scalable without microservices overhead.

MongoDB is used as the single database for all data domains. Relational integrity is enforced at the service layer rather than via foreign key constraints, following the same approach used in production enterprise systems at scale.

Full architecture documentation is available in [`/docs`](./docs).

---

## Security

- All traffic encrypted in transit via TLS (enforced by Vercel and Render)
- Passwords hashed with BCrypt (cost factor 12)
- JWT-based authentication (access token 15min, refresh token 7 days)
- Data encrypted at rest via MongoDB Atlas managed storage
- No end-to-end encryption — a deliberate tradeoff to support
  server-side AI features. Documented in
  [`docs/discussions/004_e2ee_vs_ai_features.md`](./docs/discussions/004_e2ee_vs_ai_features.md)

---

## Local Setup

> Prerequisites: Java 21, Node.js 20+, Docker (for Kafka locally)

### Backend
```bash
cd backend
cp .env.example .env        # fill in environment variables
docker compose up -d        # starts MongoDB and Kafka locally
./mvnw spring-boot:run
```

### Frontend
```bash
cd frontend
npm install
npm start
```

The frontend runs on `http://localhost:4200`
The backend runs on `http://localhost:8080`
Swagger UI is available at `http://localhost:8080/swagger-ui.html`

---

## Documentation

| Document | Description |
|---|---|
| [`FEATURES.md`](./docs/FEATURES.md) | Full feature list across all phases |
| [`TECH_STACK.md`](./docs/TECH_STACK.md) | Technology decisions and justifications |
| [`API_CONTRACTS.md`](./docs/API_CONTRACTS.md) | REST and WebSocket endpoint reference |
| [`backend/openapi.yaml`](./backend/openapi.yaml) | OpenAPI 3.1 specification (Swagger UI at `/swagger-ui.html`) |
| [`architecture/erd.md`](./docs/architecture/erd.md) | Database schema |
| [`architecture/c1_system_context.md`](./docs/architecture/c1_system_context.md) | System context diagram |
| [`architecture/c2_container.md`](./docs/architecture/c2_container.md) | Container diagram |
| [`architecture/c3_component.md`](./docs/architecture/c3_component.md) | Component diagram |
| [`discussions/`](./docs/discussions/) | Architecture Decision Records (ADRs) |

---

## Project Status

| Phase | Status |
|---|---|
| Phase 1 — Core | 🔲 In Progress |
| Phase 2 — Enhancement | 🔲 Planned |
| Phase 3 — Search & Files | 🔲 Planned |
| Phase 4 — AI Features | 🔲 Planned |

---

## Author

**Satyam** — Full Stack Developer
[GitHub](https://github.com/tkrsatyam) · [LinkedIn](https://www.linkedin.com/in/satyam-kumar-07-2001apr/)

> Built as a portfolio project to demonstrate real-time systems,
> WebSocket architecture, React, and AI integration.