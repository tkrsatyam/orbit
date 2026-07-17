# Contributing to Orbit

This document covers how to work in the Orbit monorepo — local setup conventions, branch and commit naming, pull request process, and how everything connects to Jira for work item tracking.

---

## Repository Structure

```
orbit/
├── frontend/       React SPA — deployed on Vercel
├── backend/        Spring Boot monolith — deployed on Render
└── docs/           All architecture documentation
```

Each part of the monorepo is independently deployable. GitHub Actions uses path-based filters to ensure a change in `frontend/` only triggers the frontend pipeline, and a change in `backend/` only triggers the backend pipeline. Changes to `docs/` trigger neither.

---

## Local Setup

See [DEPLOYMENT.md](./docs/DEPLOYMENT.md) for the full local setup guide. The short version:

```bash
# 1. Start infrastructure (MongoDB + Kafka via Docker)
cd backend && docker compose up -d

# 2. Run backend
./mvnw spring-boot:run

# 3. Run frontend (separate terminal)
cd frontend && npm install && npm run dev
```

Frontend: `http://localhost:5173`
Backend: `http://localhost:8080`

---

## Jira Integration

Orbit uses Jira to track all work items. The GitHub for Jira app connects this repository to the Jira project so that branches, commits, and pull requests automatically appear in the Jira Development panel for each work item.

**The Jira project key for Orbit is `ORDM`** 

### Quick Reference

```
Branch    →  git checkout -b ORDM-123-short-description
Commit    →  git commit -m "ORDM-123 what you changed"
PR title  →  [ORDM-123] What the PR does
```

### Finding Your Jira Key

Every Jira work item has a unique key in the format `ORDM-123`.

| Where to look         | What you see                            |
|-----------------------|-----------------------------------------|
| Board card            | Key displayed at the bottom of the card |
| Work item detail page | Key shown in the breadcrumb and URL     |
| Backlog list          | Key shown in the leftmost column        |

The key is case-insensitive for GitHub matching, but use uppercase to be safe.

### Branch Naming

```
ORDM-{ticket-number}-{short-description}
```

- Jira key comes first — this is what the GitHub for Jira integration uses to link the branch
- Description is lowercase with hyphens
- Keep it short — it appears in PR titles and Jira panels

**Examples:**
```
ORDM-12-websocket-stomp-config
ORDM-24-message-send-service
ORDM-31-react-conversation-list
ORDM-45-fix-kafka-consumer-offset
ORDM-67-mongodb-message-indexes
```

### Commit Messages

```
ORDM-{ticket-number} brief description of what changed
```

- Key must appear at the start of the commit message
- Every commit on the branch should contain the key — they each link individually to the Jira work item
- Use imperative mood — "add", "fix", "update", not "added", "fixed", "updated"

**Examples:**
```bash
git commit -m "ORDM-12 configure STOMP broker with SockJS fallback"
git commit -m "ORDM-24 implement persist-before-publish in MessageService"
git commit -m "ORDM-31 add conversation list with unread count badge"
```

**Housekeeping commits** unrelated to a ticket can omit the key:
```bash
git commit -m "chore: update spring-boot version to 4.1.1"
git commit -m "docs: fix typo in ERD"
```

**Smart Commits** (optional — requires Smart Commits enabled in Jira):
```bash
# Transition ticket to In Review
git commit -m "ORDM-24 #in-review MessageService send flow complete"

# Log time worked
git commit -m "ORDM-24 #time 3h implement Kafka fan-out in MessageService"

# Add a comment to the Jira ticket
git commit -m "ORDM-24 #comment tested locally, all flows working"

# Transition and log time together
git commit -m "ORDM-24 #done #time 5h complete Phase 1 message send flow"
```

### What Shows Up in the Jira Development Panel

| GitHub action | Appears in Jira if…                                    |
|---------------|--------------------------------------------------------|
| Branch        | Branch name contains the key anywhere                  |
| Commit        | Commit message contains the key anywhere               |
| Pull Request  | PR title contains the key                              |
| Build status  | GitHub Actions workflow connected via GitHub for Jira  |
| Deployment    | Deployment environment tracked via GitHub Environments |

### Workflow Summary

```
1. Pick a Jira ticket  →  note the key (e.g. ORDM-42)
2. git checkout -b ORDM-42-feature-name
3. git commit -m "ORDM-42 description of change"   ← repeat for every commit
4. Push branch → open PR with title "[ORDM-42] Feature name"
5. Jira Development panel now shows: branch ✓ · commits ✓ · pull request ✓
```

### Troubleshooting

If development information is not appearing in Jira, work through this checklist in order.

**1. Integration not set up**  
Go to Jira → Settings → Apps → GitHub for Jira. Confirm the app is installed and `tkrsatyam/orbit` is listed under connected repositories. If the repo is missing, click Add repository and authorise access.

**2. Key not in the right place**  
Branch names must contain the key anywhere in the name. Commit messages must contain the key anywhere in the body. PR title must contain the key — the PR description alone is not enough. Double-check for typos: `RO-123` instead of `ORDM-123` will silently fail.

**3. Wrong project key**  
Jira project keys are shown in Project Settings → Details. If the key is not `ORDM`, update all examples in this guide.

**4. Delay in sync**  
Jira does not update in real time. After a push, wait up to 60 seconds for commits and branches to appear. After a PR is opened or merged, allow 1–2 minutes. If nothing appears after 5 minutes, move to the steps below.

**5. Force a re-sync**  
Open the work item in Jira. Scroll to the Development panel on the right. Click the refresh icon (⟳) if available, or re-save the issue with a minor field edit to trigger a re-fetch.

**6. Re-authorise the GitHub App**  
Go to Jira → Settings → Apps → GitHub for Jira → Configure. Disconnect and reconnect the repository. This forces a full backfill of recent commits and branches.

**7. Commits not showing after squash or rebase**  
If you rewrite Git history (interactive rebase, squash merge), the original commit SHAs are replaced. The new squashed commit must still contain the Jira key in its message, otherwise the link is lost. Prefer merge commits or squash with the key preserved in the final commit message.

**8. Private repo or org-level permission issues**  
If the repo is ever made private, go back to the GitHub App settings in Jira and re-grant repository access.

**9. Build or deployment status not showing**  
Build status comes from GitHub Actions — most standard actions report status to GitHub's Checks API automatically. Deployment tracking requires using GitHub Environments in the workflow YAML (`environment: production`).

### Official Reference

- GitHub for Jira setup and troubleshooting: https://support.atlassian.com/jira-cloud-administration/docs/integrate-with-github/
- Smart Commits reference: https://support.atlassian.com/jira-software-cloud/docs/process-issues-with-smart-commits/
- Development panel not showing data: https://support.atlassian.com/jira-software-cloud/docs/view-development-information-for-an-issue/

---

## Pull Requests

### Title Format

```
[ORDM-123] Short description of what the PR does
```

**Examples:**
```
[ORDM-12] WebSocket STOMP broker configuration
[ORDM-24] Message send flow with Kafka fan-out
[ORDM-31] Conversation list UI with real-time updates
```

### PR Description Template

```markdown
## Jira
[ORDM-123](https://your-jira-site.atlassian.net/browse/ORDM-123)

## What changed
- Concise bullet list of what this PR does

## How to test
- Steps to verify the change works locally

## Affected areas
- backend / frontend / docs / CI
- Specific packages or components changed

## Notes
- Anything reviewers should be aware of — edge cases, known issues, follow-up tickets
```

### PR Rules

- One Jira ticket per PR where possible — keep PRs focused
- If a change spans both `backend/` and `frontend/`, a single PR is fine — path-based CI handles independent pipeline triggers
- All CI checks must pass before merging
- Squash merge is preferred — preserves a clean main branch history. Ensure the squash commit message retains the Jira key

---

## CI/CD Pipelines

Two independent GitHub Actions workflows run on push to `main`:

| Workflow              | Triggered by             | What it does                                             |
|-----------------------|--------------------------|----------------------------------------------------------|
| `deploy-backend.yml`  | Changes in `backend/**`  | Builds JAR, runs tests, deploys to Render via API        |
| `deploy-frontend.yml` | Changes in `frontend/**` | Runs `npm ci`, builds, deploys to Vercel via Deploy Hook |

Changes to `docs/**` trigger neither pipeline.

**Vercel auto-deploy is disabled** via `vercel.json` in the `frontend/` directory. All Vercel deployments happen exclusively through the GitHub Actions pipeline. This prevents race conditions between Vercel's built-in Git integration and the CI pipeline — a problem solved in the companion project (JobTrackr).

**`fetch-depth: 2`** is set on all checkout steps. A shallow clone with the default depth of 1 causes failures in steps that reference `HEAD^`. This is a known issue resolved in the companion project.

---

## GitHub Issues and Bug Sync

When a GitHub Issue is labelled with `bug`, a GitHub Actions workflow (`jira-bug-sync.yml`) automatically:

1. Creates a corresponding Bug in Jira with the issue title and body (converted to Atlassian Document Format)
2. Comments a link back to the Jira ticket on the GitHub Issue
3. Adds a `jira-synced` label to the GitHub Issue to prevent duplicate creation

**Required GitHub Secrets for this workflow:**

| Secret            | Description                                                  |
|-------------------|--------------------------------------------------------------|
| `JIRA_BASE_URL`   | Your Jira site URL e.g. `https://yoursite.atlassian.net`     |
| `JIRA_AUTH_TOKEN` | Base64-encoded `email:api-token` for Jira API authentication |

The sync is one-directional — GitHub Issue → Jira Bug. Manual Jira tickets are not synced back to GitHub Issues.

The workflow and conversion script (`.github/scripts/create-jira-bug.mjs`) are adapted from the companion project (JobTrackr). The only change needed is the project key — `ORDM` instead of `JD` — inside the script payload.

---

## Documentation

Architecture documentation lives in `docs/`. When making changes that affect the architecture — new endpoints, schema changes, new components — update the relevant doc alongside the code change and include it in the same PR.

| Changed                                    | Update                                                                           |
|--------------------------------------------|----------------------------------------------------------------------------------|
| New REST endpoint or WebSocket destination | `docs/API_CONTRACTS.md`                                                          |
| New MongoDB collection or field            | `docs/architecture/erd.md`                                                       |
| New backend package or component           | `docs/architecture/c3_component.md`                                              |
| New external system dependency             | `docs/architecture/c1_system_context.md` and `docs/architecture/c2_container.md` |
| New architectural decision                 | Add an ADR to `docs/discussions/` using `docs/_templates/DISCUSSION_TEMPLATE.md` |

---

## Code Conventions

### Backend (Spring Boot)

- Package structure follows the feature-package layout defined in `docs/architecture/c3_component.md` — one package per domain (`auth`, `user`, `contact`, `group`, `conversation`, `message`, `websocket`, `presence`, `search`, `ai`, `common`)
- Controllers contain no business logic — delegate to service immediately
- Services own all transactional boundaries — `@Transactional` only in service layer
- Repositories never call other repositories — cross-collection operations belong in the service layer
- Persist to MongoDB before publishing to Kafka — always, without exception (see `docs/architecture/sequences/message_send_flow.md`)

### Frontend (React)

- Component files use PascalCase: `ConversationList.jsx`
- Hook files use camelCase prefixed with `use`: `useWebSocket.js`
- Environment variables must be prefixed with `VITE_` to be exposed at build time
- JWT access token stored in memory only — never in `localStorage` or `sessionStorage`
