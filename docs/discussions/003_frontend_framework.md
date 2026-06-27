# 003 — Frontend Framework Selection

> **Format:** Architecture Decision Record (ADR)
> **Reference:** https://adr.github.io
> **Date:** 2026-06-27
> **Status:** Accepted

---

## Context

Orbit needed a frontend framework for building a real-time
chat UI. The developer has production experience with Angular
(signals-first architecture, Angular Material, standalone
components) from both an enterprise project and a separate
portfolio project.

The frontend requirements for Orbit are:
- Real-time message rendering via WebSocket
- Responsive chat UI with conversation list and message thread
- Group discovery and user profile views
- JWT auth with protected routes
- File and image upload (Phase 3)
- AI feature interactions (Phase 4)

The primary constraint: the developer has zero prior React
exposure but is actively job hunting and observes React listed
as a requirement on most target job descriptions.

---

## Options Considered

### Option 1 — Angular
Continue with the framework used in the companion portfolio
project (job application tracker).

**Pros:**
- No learning curve — production-level familiarity
- Signals architecture maps directly to real-time UI updates
- Reuse auth patterns, interceptors, guards from prior project
- Faster time to working demo

**Cons:**
- Does not add a new skill to the resume
- Two portfolio projects, same frontend framework — missed
  opportunity to demonstrate breadth
- Angular appears on fewer job descriptions than React
  in the target job market

### Option 2 — Next.js
React framework with server-side rendering, static generation,
and file-based routing built in.

**Pros:**
- React knowledge transfers — Next.js is React with conventions
- Vercel deployment is trivially easy (already used for Angular)
- Growing enterprise adoption

**Cons:**
- Requires learning React fundamentals before Next.js conventions
- App Router + WebSocket integration has nuance —
  server components cannot hold socket state
- Adds framework-level complexity on top of React learning
- Solves problems Orbit doesn't have: SEO (app is behind login),
  API routes (Spring Boot handles this), static generation
  (chat is fully dynamic)
- Too many unknowns simultaneously for a side project built
  alongside an active portfolio project

### Option 3 — Vue 3
Progressive JavaScript framework with composition API.

**Pros:**
- Gentle learning curve
- Composition API is conceptually similar to React hooks

**Cons:**
- Smaller market share in the target job market compared to React
- Does not meaningfully improve resume signal over Angular
- Not commonly listed in target job descriptions

### Option 4 — React (Chosen)
UI library with hooks, component model, and a large ecosystem.

**Pros:**
- Most listed frontend requirement in target job descriptions
- Demonstrates framework flexibility — not locked to Angular
- Conceptually close to Angular signals — mental model transfers
- Large ecosystem and community for reference during learning
- Vite scaffold removes boilerplate setup decisions
- Combined with Spring Boot backend knowledge, covers the
  most common full-stack combination seen in job descriptions

**Cons:**
- Zero prior exposure — learning curve during active development
- Higher risk of slower initial progress compared to Angular
- No Angular-style opinions on structure — requires deliberate
  folder organisation decisions

---

## Decision

Orbit's frontend is built with **React** using Vite as the
build tool, React Router for navigation, and SockJS + STOMP
for WebSocket client communication.

The learning investment in React is justified by the frequency
with which it appears in target job descriptions. Building a
real project is the most effective learning mechanism —
a chat app provides clear, immediate UI feedback that
accelerates React fundamentals significantly.

### Why Not Next.js

Next.js was explicitly evaluated and rejected for this project.
The overhead of learning React fundamentals simultaneously with
Next.js App Router conventions, server component boundaries,
and WebSocket constraints was assessed as too high for a side
project built in parallel with active job hunting.

Next.js remains a deliberate future learning target once
React fundamentals are solid. The knowledge transfer from
React to Next.js is straightforward — the reverse is not.

### Resume Narrative

The two portfolio projects together cover a deliberate
frontend breadth story:

- Job Application Tracker → Angular (signals, standalone
  components, Angular Material)
- Orbit → React (hooks, component model, real-time UI)

Two frontend frameworks, one consistent Spring Boot backend,
demonstrates adaptability rather than single-framework depth.

---

## Drawbacks Acknowledged

- Initial development velocity will be lower due to React
  learning curve
- No Angular-style structure opinions — folder organisation
  and state management patterns require deliberate decisions
- Risk of demo quality being lower than the Angular project
  if React fundamentals take longer than expected to solidify

---

## Evolution Path

- **Next.js migration** — once React fundamentals are solid,
  Orbit could be migrated to Next.js App Router as a learning
  exercise. Most component code transfers directly.
- **React Native** — if a mobile version of Orbit is ever
  considered, React knowledge transfers directly to
  React Native. Angular does not have an equivalent path.

---

## References

- React Documentation — https://react.dev
- Vite — https://vitejs.dev
- SockJS Client — https://github.com/sockjs/sockjs-client
- STOMP.js — https://stomp-js.github.io/stomp-websocket