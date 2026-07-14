# Deployment

This document covers everything needed to run Orbit locally and deploy it to production. Local setup uses Docker for infrastructure dependencies. Production runs on free-tier managed services with GitHub Actions handling all CI/CD.

---

## Architecture Overview

```
Local Development                         Production
─────────────────────────────────         ─────────────────────────────────
React (Vite dev server :5173)             React SPA → Vercel
Spring Boot (:8080)                       Spring Boot → Render
MongoDB (Docker :27017)                   MongoDB Atlas (M0 free tier)
Kafka + Zookeeper (Docker :9092)          Upstash Kafka (serverless)
                                          Cloudflare R2 (object storage)
```

---

## Prerequisites

| Tool           | Version              | Purpose                                 |
|----------------|----------------------|-----------------------------------------|
| Java           | 21 (LTS)             | Spring Boot runtime                     |
| Node.js        | 20+                  | React dev server and build              |
| Docker Desktop | Latest stable        | MongoDB + Kafka locally                 |
| Maven          | Bundled via `./mvnw` | Backend build — no local install needed |
| Git            | Any recent           | Source control                          |

---

## Repository Structure

```
orbit/
├── backend/                  Spring Boot application
│   ├── src/
│   ├── pom.xml
│   ├── .env.example          template for required environment variables
│   └── docker-compose.yml    local MongoDB + Kafka
├── frontend/                 React application
│   ├── src/
│   ├── package.json
│   ├── vite.config.js
│   └── .env.example          template for required environment variables
└── docs/                     all architecture documentation
```

---

## Local Development Setup

### Step 1 — Clone the repository

```bash
git clone https://github.com/tkrsatyam/orbit.git
cd orbit
```

### Step 2 — Start infrastructure (MongoDB + Kafka)

```bash
cd backend
docker compose up -d
```

This starts three containers:
- `orbit-mongo` — MongoDB on port 27017
- `orbit-kafka` — Kafka broker on port 9092
- `orbit-zookeeper` — Zookeeper on port 2181 (required by Kafka)

Verify containers are running:

```bash
docker compose ps
```

### Kafbat UI — Kafka Dashboard (local only)

Kafbat UI is included in docker-compose.yml for local development only. It provides a visual dashboard to inspect Kafka topics, browse messages, and monitor consumer group offsets.

Access it at: http://localhost:8090

This is useful from Phase 1 onward when Kafka is first used. It is especially important when debugging the WebSocket fan-out — you can confirm whether a message was successfully published to chat.messages before investigating the consumer or WebSocket delivery side.

What to check in Kafbat during development:
- Topics tab: confirms chat.messages, chat.presence, and chat.notifications exist
- Messages tab per topic: shows the exact payload of each published event
- Consumer Groups tab: shows the orbit-backend consumer group and its offset per partition — if offset is not advancing, the consumer is not picking up events

Kafbat is a local development tool only. It is not deployed to Render or any production environment.

### Step 3 — Configure backend environment

```bash
cp .env.example .env
```

Open `.env` and fill in the required values:

```env
# Server
SERVER_PORT=8080

# MongoDB
MONGODB_URI=mongodb://localhost:27017/orbit

# Kafka
KAFKA_BOOTSTRAP_SERVERS=localhost:9092

# JWT
JWT_SECRET=your-256-bit-secret-here-generate-with-openssl-rand-hex-32
JWT_ACCESS_TOKEN_EXPIRY_MS=900000
JWT_REFRESH_TOKEN_EXPIRY_MS=604800000

# Cloudflare R2 (use dev bucket for local — optional until Phase 3)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=orbit-dev
R2_PUBLIC_URL=

# Claude API (optional until Phase 4)
ANTHROPIC_API_KEY=
```

Generate a secure JWT secret:

```bash
openssl rand -hex 32
```

### Step 4 — Run the backend

```bash
./mvnw spring-boot:run
```

Backend starts on `http://localhost:8080`. On first run, Spring Data MongoDB creates all collections and indexes automatically via `@Document` and `@Indexed` annotations.

Health check:

```bash
curl http://localhost:8080/actuator/health
```

Expected response: `{"status":"UP"}`

### Step 5 — Configure frontend environment

```bash
cd ../frontend
cp .env.example .env
```

Open `.env` and fill in:

```env
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080/ws
```

### Step 6 — Run the frontend

```bash
npm install
npm run dev
```

Frontend starts on `http://localhost:5173`.

---

## Environment Variables Reference

### Backend — full reference

| Variable                      | Required | Description                                                    |
|-------------------------------|----------|----------------------------------------------------------------|
| `SERVER_PORT`                 | Yes      | Port the Spring Boot app listens on                            |
| `MONGODB_URI`                 | Yes      | MongoDB connection string                                      |
| `KAFKA_BOOTSTRAP_SERVERS`     | Yes      | Kafka broker address                                           |
| `JWT_SECRET`                  | Yes      | HS256 signing secret, minimum 256 bits                         |
| `JWT_ACCESS_TOKEN_EXPIRY_MS`  | Yes      | Access token TTL in milliseconds (default 900000 = 15 min)     |
| `JWT_REFRESH_TOKEN_EXPIRY_MS` | Yes      | Refresh token TTL in milliseconds (default 604800000 = 7 days) |
| `R2_ACCOUNT_ID`               | Phase 3+ | Cloudflare account ID                                          |
| `R2_ACCESS_KEY_ID`            | Phase 3+ | R2 API access key                                              |
| `R2_SECRET_ACCESS_KEY`        | Phase 3+ | R2 API secret key                                              |
| `R2_BUCKET_NAME`              | Phase 3+ | R2 bucket name                                                 |
| `R2_PUBLIC_URL`               | Phase 3+ | Public base URL for R2 objects                                 |
| `ANTHROPIC_API_KEY`           | Phase 4+ | Claude API key for AI features                                 |

### Frontend — full reference

| Variable            | Required | Description                |
|---------------------|----------|----------------------------|
| `VITE_API_BASE_URL` | Yes      | Backend REST API base URL  |
| `VITE_WS_URL`       | Yes      | Backend WebSocket endpoint |

All frontend environment variables must be prefixed with `VITE_` to be exposed to the Vite build.

---

## Docker Compose — Local Infrastructure

Full `docker-compose.yml` for reference:

```yaml
services:
  mongo:
    image: mongo:7
    container_name: orbit-mongo
    ports:
      - "27017:27017"
    volumes:
      - orbit-mongo-data:/data/db
    healthcheck:
      test: ["CMD", "mongosh", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5

  zookeeper:
    image: confluentinc/cp-zookeeper:7.6.0
    container_name: orbit-zookeeper
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
    ports:
      - "2181:2181"

  kafka:
    image: confluentinc/cp-kafka:7.6.0
    container_name: orbit-kafka
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: true
      
  kafbat-ui:
    image: ghcr.io/kafbat/kafka-ui:latest
    container_name: orbit-kafbat-ui
    ports:
      - "8090:8080"
    depends_on:
      - kafka
    environment:
      KAFKA_CLUSTERS_0_NAME: orbit-local
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:9092

volumes:
  orbit-mongo-data:
```

Kafka topics are auto-created on first publish. In production, Upstash Kafka requires topics to be created manually in the Upstash console before the app starts.

---

## Production Infrastructure

### Services Used

| Service        | Purpose                     | Free Tier Limits                                              |
|----------------|-----------------------------|---------------------------------------------------------------|
| Vercel         | React frontend hosting      | Unlimited deployments, 100GB bandwidth/month                  |
| Render         | Spring Boot backend hosting | 750 hours/month, 512MB RAM, spins down after 15min inactivity |
| MongoDB Atlas  | Managed MongoDB             | M0: 512MB storage, shared cluster                             |
| Upstash Kafka  | Managed Kafka               | 10,000 messages/day, 100MB storage                            |
| Cloudflare R2  | Object storage              | 10GB storage, 1M Class A ops/month free                       |
| GitHub Actions | CI/CD pipelines             | 2,000 minutes/month                                           |

### Important — Render Cold Starts

The Render free tier spins down inactive services after 15 minutes of inactivity. The first request after spin-down takes 30–60 seconds. This is expected behaviour on the free tier. For demo purposes, a simple uptime ping service (such as UptimeRobot's free tier) can ping the health endpoint every 10 minutes to keep the instance warm.

---

## Production Setup — One Time

### 1. MongoDB Atlas

1. Create a free account at [mongodb.com/atlas](https://mongodb.com/atlas)
2. Create a new project named `orbit`
3. Create a free M0 cluster in the region closest to your Render deployment
4. Under **Database Access**: create a user with read/write access, note the username and password
5. Under **Network Access**: add `0.0.0.0/0` to allow connections from Render's dynamic IPs
6. Get the connection string from **Connect → Drivers**: `mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/orbit`

### 2. Upstash Kafka

1. Create a free account at [upstash.com](https://upstash.com)
2. Create a new Kafka cluster, select the region closest to your Render deployment
3. Create the following topics manually in the Upstash console:

| Topic                | Partitions | Retention |
|----------------------|------------|-----------|
| `chat.messages`      | 1          | 7 days    |
| `chat.presence`      | 1          | 1 hour    |
| `chat.notifications` | 1          | 7 days    |

4. Note the bootstrap server URL, SASL username, and SASL password from the cluster details page

### 3. Cloudflare R2 (Phase 3+)

1. Create a Cloudflare account at [cloudflare.com](https://cloudflare.com)
2. Navigate to R2 in the dashboard
3. Create a bucket named `orbit-prod`
4. Under **Manage R2 API Tokens**: create a token with object read/write permissions scoped to `orbit-prod`
5. Note the Account ID, Access Key ID, and Secret Access Key
6. Enable public access on the bucket and note the public URL

### 4. Render — Backend

1. Create a free account at [render.com](https://render.com)
2. New → Web Service → Connect GitHub repository → select `orbit`
3. Configure:
   - **Root Directory:** `backend`
   - **Runtime:** Docker (or Java if available)
   - **Build Command:** `./mvnw clean package -DskipTests`
   - **Start Command:** `java -jar target/orbit-*.jar`
4. Under **Environment Variables**, add all backend variables from the reference table above using production values
5. Note the generated Render URL (e.g. `https://orbit-backend.onrender.com`)

### 5. Vercel — Frontend

1. Create a free account at [vercel.com](https://vercel.com)
2. New Project → Import Git repository → select `orbit`
3. Configure:
   - **Root Directory:** `frontend`
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Under **Environment Variables**, add `VITE_API_BASE_URL` and `VITE_WS_URL` using production values
5. **Critical:** Disable Vercel's automatic Git deployment by adding a `vercel.json` file to the `frontend/` directory:

```json
{
  "git": {
    "deploymentEnabled": false
  }
}
```

This prevents Vercel from deploying on every push to main. Deployments are triggered exclusively via the GitHub Actions pipeline using a Vercel Deploy Hook. Without this, Vercel and GitHub Actions both deploy simultaneously causing race conditions and redundant builds — this issue was encountered and resolved in the companion project (JobTrackr).

6. Under **Settings → Git → Deploy Hooks**: create a deploy hook named `github-actions` and copy the generated URL. This URL is stored as `VERCEL_DEPLOY_HOOK_URL` in GitHub Secrets.

---

## CI/CD Pipeline

Orbit uses path-based GitHub Actions workflows so that a backend change does not trigger a frontend build and vice versa.

### GitHub Secrets Required

Add these under **repository Settings → Secrets and variables → Actions**:

| Secret                    | Description                                |
|---------------------------|--------------------------------------------|
| `RENDER_API_KEY`          | Render API key for triggering deploys      |
| `RENDER_SERVICE_ID`       | Render service ID for the backend          |
| `VERCEL_DEPLOY_HOOK_URL`  | Vercel deploy hook URL for the frontend    |
| `MONGODB_URI`             | Production MongoDB Atlas connection string |
| `KAFKA_BOOTSTRAP_SERVERS` | Upstash Kafka bootstrap server             |
| `KAFKA_SASL_USERNAME`     | Upstash Kafka SASL username                |
| `KAFKA_SASL_PASSWORD`     | Upstash Kafka SASL password                |
| `JWT_SECRET`              | Production JWT signing secret              |
| `ANTHROPIC_API_KEY`       | Claude API key (add when Phase 4 begins)   |

### Backend Pipeline — `.github/workflows/deploy-backend.yml`

```yaml
name: Deploy Backend

on:
  push:
    branches: [main]
    paths:
      - 'backend/**'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Java 21
        uses: actions/setup-java@v4
        with:
          java-version: '21'
          distribution: 'temurin'
          cache: maven

      - name: Build
        working-directory: backend
        run: ./mvnw clean package -DskipTests

      - name: Run tests
        working-directory: backend
        run: ./mvnw test

      - name: Deploy to Render
        run: |
          curl -X POST "${{ secrets.RENDER_API_KEY }}" \
            -H "Authorization: Bearer ${{ secrets.RENDER_API_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"serviceId": "${{ secrets.RENDER_SERVICE_ID }}"}'
```

### Frontend Pipeline — `.github/workflows/deploy-frontend.yml`

```yaml
name: Deploy Frontend

on:
  push:
    branches: [main]
    paths:
      - 'frontend/**'

jobs:
  build-and-deploy:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout
        uses: actions/checkout@v4
        with:
          fetch-depth: 2

      - name: Set up Node.js 20
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        working-directory: frontend
        run: npm ci

      - name: Build
        working-directory: frontend
        run: npm run build
        env:
          VITE_API_BASE_URL: ${{ secrets.VITE_API_BASE_URL }}
          VITE_WS_URL: ${{ secrets.VITE_WS_URL }}

      - name: Deploy to Vercel via Deploy Hook
        run: curl -X POST "${{ secrets.VERCEL_DEPLOY_HOOK_URL }}"
```

`fetch-depth: 2` is set intentionally. A shallow clone with the default `fetch-depth: 1` only fetches the latest commit and `HEAD^` does not exist, which causes issues with any step that compares the current commit to the previous one. This was a resolved issue from the companion project (JobTrackr).

---

## Database Indexes

Indexes are created automatically on application startup via Spring Data MongoDB annotations. On first boot against a fresh Atlas cluster, startup will take slightly longer as indexes are built. The following indexes are applied:

| Collection    | Index                         | Type            |
|---------------|-------------------------------|-----------------|
| users         | email                         | Unique          |
| users         | displayName                   | Text            |
| contacts      | { requesterId, receiverId }   | Unique compound |
| contacts      | { receiverId, status }        | Compound        |
| groups        | name                          | Unique          |
| groups        | { visibility, topicTag }      | Compound        |
| groups        | members.userId                | Standard        |
| groups        | inviteToken                   | Sparse          |
| conversations | participantIds                | Standard        |
| conversations | { participantIds, type }      | Compound        |
| conversations | groupId                       | Sparse          |
| messages      | { conversationId, createdAt } | Compound        |
| messages      | { conversationId, _id }       | Compound        |
| messages      | { conversationId, content }   | Text compound   |
| notifications | { userId, read }              | Compound        |
| notifications | { userId, conversationId }    | Compound        |

---

## Useful Commands

### Backend

```bash
# Run with a specific Spring profile
./mvnw spring-boot:run -Dspring-boot.run.profiles=local

# Run tests only
./mvnw test

# Build JAR without running tests
./mvnw clean package -DskipTests

# Check which port the app is running on
lsof -i :8080
```

### Frontend

```bash
# Install dependencies
npm ci

# Start dev server
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview
```

### Docker

```bash
# Start all infrastructure containers
docker compose up -d

# Stop all containers
docker compose down

# Stop and remove volumes (wipes local MongoDB data)
docker compose down -v

# View container logs
docker compose logs -f kafka

# Open MongoDB shell
docker exec -it orbit-mongo mongosh orbit
```

### MongoDB Shell — useful queries

```javascript
// List all collections
show collections

// Count documents in a collection
db.messages.countDocuments()

// Find all users
db.users.find({}, { email: 1, displayName: 1, online: 1 })

// Find messages in a conversation
db.messages.find({ conversationId: ObjectId("...") }).sort({ createdAt: -1 }).limit(10)

// Drop all collections (reset local database)
db.dropDatabase()
```

---

## Troubleshooting

**Backend fails to start — MongoDB connection refused**
Docker containers may not be running. Run `docker compose up -d` from the `backend/` directory and wait for the health check to pass before starting Spring Boot.

**Backend fails to start — Kafka connection refused**
Same cause — Kafka container not running or still initialising. Kafka takes 10–15 seconds after container start before it accepts connections. Add a retry delay or run `docker compose logs kafka` to confirm it is ready.

**WebSocket connections failing locally**
Confirm the backend is running on port 8080 and `VITE_WS_URL` in `frontend/.env` matches exactly: `ws://localhost:8080/ws`. HTTPS/WSS is not required locally.

**Render deployment succeeds but app returns 503**
Render free tier instances spin down after 15 minutes of inactivity. The first request after spin-down triggers a cold start that takes 30–60 seconds. Subsequent requests are fast. Use UptimeRobot to keep the instance warm during demos.

**Vercel deploying on every push despite `deploymentEnabled: false`**
Confirm `vercel.json` is committed inside the `frontend/` directory, not the repo root. Vercel reads the config relative to the configured root directory of the project.

**GitHub Actions frontend workflow fails on `HEAD^` reference**
Confirm `fetch-depth: 2` is set in the checkout step. The default `fetch-depth: 1` produces a shallow clone where `HEAD^` does not exist.

**Atlas connection string rejected by Spring Boot**
Ensure the connection string uses the `mongodb+srv://` protocol and that the Atlas cluster's network access allows `0.0.0.0/0`. The `orbit` database name must be appended at the end of the URI: `...mongodb.net/orbit`.
