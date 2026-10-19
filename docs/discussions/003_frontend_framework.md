# 003 — Frontend Framework Selection

> **Format:** Architecture Decision Record (ADR)  
> **Reference:** https://adr.github.io  
> **Date:** 2026-06-27 (Amended: 2026-10-19)  
> **Status:** Superseded by Amendment  

---

## Context

Orbit required a frontend framework for building a real-time chat single-page application (SPA). The developer has production experience with Angular (signals-first architecture, standalone components) from enterprise applications.

The key requirements for Orbit are:
- Real-time message streaming via WebSocket (STOMP over SockJS)
- High-frequency event handling (typing indicators, presence ticks, optimistic message state)
- Large conversation histories requiring virtual scrolling (1,000+ messages)
- JWT auth with stateless in-memory access tokens, httpOnly refresh cookie rotation, and route protection
- Public group discovery and private invite-only channels
- File and image uploads via Cloudflare R2 (Phase 3)
- Real-time AI bot interactions and streaming responses (Phase 4)

---

## Initial Decision (2026-06-27)

Orbit's frontend was initially scaffolded in **React 19** with Vite. The decision was motivated primarily by resume positioning: demonstrating framework breadth alongside an existing Angular portfolio project.

---

## Amendment & Superseding Decision (2026-10-19)

### Rationale for Superseding React with Angular 21

During the completion of Phase 1 Authentication and preparation for real-time WebSocket messaging, the architectural trade-offs between React and Angular were re-evaluated against Orbit's domain requirements:

1. **Native Stream Orchestration (RxJS)**:
   - WebSockets, typing indicators, and presence updates are asynchronous event streams.
   - In React, managing persistent socket subscriptions across components requires complex `useEffect` lifecycles, manual cleanup handlers, and mutable refs to avoid stale closures.
   - Angular natively integrates RxJS. STOMP frames, typing events, and presence topics map directly to Observables. Operators such as `filter`, `debounceTime`, `distinctUntilChanged`, `switchMap`, and `shareReplay` manage streams declaratively.

2. **Signals & High-Frequency UI Performance**:
   - In active chat rooms, incoming messages, typing events, and presence status changes fire constantly.
   - React updates state by re-executing component functions and re-diffing virtual DOM trees, requiring aggressive memoization (`React.memo`, `useMemo`, `useCallback`) to avoid frame drops.
   - Modern Angular signals (`signal()`, `computed()`) provide template-level dependency tracking. State changes update only the exact DOM node bound to the signal without re-executing component logic.

3. **Message Virtual Scrolling (`@angular/cdk/scrolling`)**:
   - Long message histories require virtualized scrolling with stable scroll-anchoring when older messages prepend at the top.
   - Angular CDK provides `CdkVirtualScrollViewport`, an officially maintained Google library built specifically for high-performance scroll lists.

4. **HTTP Interception & Route Guards**:
   - Handling token refresh with concurrent request deduplication in Axios required manual promise queues.
   - Angular's functional interceptors (`HttpInterceptorFn`) and functional guards (`CanActivateFn`) model token refresh and route protection cleanly through standard framework pipelines.

5. **Type Safety & Maintainability**:
   - Angular enforces strict TypeScript across components, services, and templates. This eliminates runtime property typos and malformed payload bugs before code reaches the browser.

---

## Revised Decision

Orbit's frontend is built with **Angular 21** using:
- **Standalone Components**: Modular architecture with no `NgModules`.
- **Angular Signals**: Fine-grained reactivity for UI and auth state.
- **RxJS**: Stream management for WebSockets and HTTP pipelines.
- **Angular CDK**: Virtual scrolling for message threads.
- **Angular CLI**: Build and test tooling with Vite/ESBuild under the hood.

---

## References

- Angular Documentation — https://angular.dev
- Angular CDK Virtual Scrolling — https://material.angular.io/cdk/scrolling/overview
- STOMP.js — https://stomp-js.github.io/stomp-websocket
- SockJS Client — https://github.com/sockjs/sockjs-client