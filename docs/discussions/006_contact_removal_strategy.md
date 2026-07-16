# 006 — Contact Removal Strategy: Delete vs Soft-Reset

> **Format:** Architecture Decision Record (ADR)  
> **Reference:** https://adr.github.io  
> **Date:** 2026-07-17  
> **Status:** Accepted

---

## Context

The `contacts` collection tracks connection requests and established relationships between users, with a `status` enum of `PENDING | CONNECTED | BLOCKED`. When a user removes an existing contact ("unfriend"), a decision was needed on how that removal is represented in the schema.

An earlier draft of `erd.md` described this ambiguously — it referenced persisting the document "for audit trail" while simultaneously describing a reset to a `NONE` status, which is not a defined enum value. This surfaced during a documentation review ahead of Phase 1 Jira ticket creation and required a clear decision before contact-related tickets could be scoped accurately.

The `BLOCKED` status was not in question — it already has a clear enforcement need (a blocked user must not be able to re-request or message the blocker) and was already correctly modelled as a persistent status. The open question was specifically about the neutral "unfriend" case.

---

## Options Considered

### Option 1 — Soft Reset (Persist with a REMOVED status)
Add a fourth enum value, `REMOVED`, set on unfriend instead of deleting the document. The `conversationId` reference remains on the document; a subsequent connection request creates a new document rather than reusing the old one.

**Pros:**
- Preserves a historical record that two users were previously connected
- No document is ever hard-deleted, which is a simpler mental model for some auditing scenarios

**Cons:**
- Requires loosening the unique compound index on `{ requesterId, receiverId }`, since a `REMOVED` document and a new `PENDING` document would otherwise collide
- Every "are these two users contacts" query must now filter by status rather than relying on document existence alone
- No feature anywhere in `FEATURES.md` surfaces connection history to a user — this complexity has no visible product payoff
- Reads as speculative complexity rather than a deliberate design choice when the schema is reviewed

### Option 2 — Hard Delete on Unfriend (Chosen)
On unfriend, the `contacts` document is deleted entirely. `NONE` is not a stored enum value — it is simply the absence of a document between two users. A future connection request creates a fresh document.

**Pros:**
- Matches the user's mental model from every mainstream product (Facebook, LinkedIn, Instagram) — unfriending is a quiet, reversible action with no visible trace
- Keeps the `status` enum exactly as small as the enforcement model requires: `PENDING | CONNECTED | BLOCKED`
- No index changes required — the existing unique compound index on `{ requesterId, receiverId }` continues to work as-is
- "Are these two users contacts" remains a simple existence + status query
- Draws a clean, defensible line: persist what must be enforced (BLOCKED), don't persist what doesn't need to be

**Cons:**
- No historical record if two users disconnect and reconnect later
- If contact history is ever needed for a future feature (e.g. "you were previously connected"), it would need to be added later as a separate concern

---

## Decision

Orbit deletes the `contacts` document entirely on unfriend/remove. No `REMOVED` or `NONE` status is stored.

This decision deliberately mirrors the asymmetry already present between `BLOCKED` and the rest of the enum: `BLOCKED` persists because it has a real, ongoing enforcement requirement — a blocked user must never be able to re-request or message the blocker again. Unfriending has no equivalent requirement. It is a neutral, mutual action, and no feature in the product surfaces connection history to a user. Persisting it would add schema and query complexity (index changes, status-filtered queries everywhere) for a capability nothing in the app actually uses.

This keeps the `contacts` collection's enum exactly as large as the enforcement model requires — nothing more.

---

## Drawbacks Acknowledged

- No audit trail exists if two users unfriend and later reconnect — the new `CONNECTED` document has no reference to the prior relationship
- If a future phase ever needs connection history (e.g. for moderation or analytics), this would require a new, separate mechanism rather than reusing the existing `contacts` collection

---

## Evolution Path

If a future requirement emerges for connection history (moderation tooling, "previously connected" UI, abuse investigation), the recommended approach is a separate `contactHistory` collection populated by an event listener on removal — rather than retrofitting a status value onto the live `contacts` collection. This keeps the live collection's query patterns simple while still allowing historical tracking to be added without a breaking schema change.

---

## References

- `docs/architecture/erd.md` — `contacts` collection schema and integrity rules
- `docs/FEATURES.md` — Phase 1 Contacts feature list (no connection-history feature present)
- ADR 005 — `docs/discussions/005_database_strategy.md` — general referential integrity conventions used across collections