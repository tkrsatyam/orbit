# 013 — Blocking Endpoint Design: User-Keyed, Not Contact-Keyed

> **Format:** Architecture Decision Record (ADR)
> **Reference:** https://adr.github.io
> **Date:** 2026-07-27
> **Status:** Accepted

---

## Context

The original API design exposed blocking as `POST /api/v1/contacts/{contactId}/block` — an action performed on an *existing* `contacts` document. This works cleanly for the case of blocking someone you're already connected with, or who has a pending request in flight with you.

It does not work at all for blocking a total stranger — someone encountered in a shared group, in search results, or on a profile page, with no prior connection request ever sent or received between the two users. There is no `contactId` to act on in that case, and the original design had no fallback for it.

This gap surfaced during Phase 1 backlog planning, while auditing the Contacts epic's stories for completeness against the documented endpoints.

---

## Options Considered

### Option 1 — Two endpoints: keep `{contactId}`-based blocking, add a separate `{userId}`-based one for strangers
The existing endpoint stays for the "already connected/pending" case; a new `POST /api/v1/users/{userId}/block` is added for the "no relationship yet" case.

**Pros:**
- No change to the existing endpoint or any code that already assumes it
- Each endpoint maps to a distinct UI entry point (contact list row vs. a stranger's profile page)

**Cons:**
- Two endpoints doing conceptually the same thing (establish a one-directional block), differentiated only by which identifier happens to be on hand client-side
- Client code needs to know which case it's in before deciding which endpoint to call, instead of the backend just handling it
- Doesn't match how blocking is actually implemented in any of the reference apps checked (see below) — none of them expose two separate block actions

### Option 2 — Single endpoint, keyed by `userId`, resolved server-side (chosen)
Collapse to `POST /api/v1/users/{userId}/block`. The backend looks up any existing `contacts` document between the two users (in either direction); if found, its status is updated to `BLOCKED` and `blockedBy` is set; if not found, a new `contacts` document is created directly with `status: BLOCKED`. The caller never needs to know or care which case applies.

**Pros:**
- Matches an extremely consistent cross-app pattern: WhatsApp (block from an unsaved number's chat, a lock-screen notification, or Privacy settings — no prior saved contact required), Instagram (block directly from a comment, a DM thread, or the profile itself — no prior follow or message exchange required), and Signal (block directly from a message *request*, before ever formally accepting a conversation) all block by target identity, never by a relationship-record identity — confirmed via live search during this decision, not assumed from memory
- Matches standard REST resource design for actions whose real subject is "the other person," not "this particular relationship row" — the same pattern used by e.g. GitHub's follow-user endpoint (keyed by username) and X/Twitter's block endpoint (`POST /users/:id/blocking`, keyed by target user)
- One client code path regardless of where blocking was triggered from in the UI
- `userId` is always known to the client in every case a `contactId` was previously known in (the contact list response already includes each contact's `userId`), so nothing is lost by dropping the `contactId`-keyed variant entirely

**Cons:**
- Removes the existing `{contactId}`-based endpoint outright rather than leaving it in place — a breaking change to the (not-yet-implemented) contract, though since Phase 1 hasn't been built yet, there's no running code or client depending on it
- Server-side upsert logic (find-or-create) is marginally more complex than a plain update, though this is a small, well-understood pattern already used elsewhere in this codebase's service layer (e.g. contact-accept's transactional multi-document write)

---

## Decision

Option 2. Single endpoint: `POST /api/v1/users/{userId}/block`, upserting the `contacts` document server-side. The prior `POST /api/v1/contacts/{contactId}/block` is retired — it is strictly subsumed by the new endpoint, since every case it handled is also reachable by `userId`.

Layering follows the URL, not the data model: `UserController` exposes both the block and unblock routes (matching the `/users/` prefix), with thin `UserService.blockUser()`/`unblockUser()` methods that delegate to `ContactService`, which retains ownership of all actual `Contact` document manipulation — it already owns every other status transition on that same model (accept, decline, unfriend), so blocking joins that existing set rather than forking off a separate owner. This is the same cross-package call pattern already established for the block-status *lookup* (`MessageService`/`UserService` already call into `ContactService` for that) — this decision just extends the same pattern to the block/unblock *action* as well. Caught and corrected during backlog planning after noticing the original draft had `ContactController` exposing a `/users/` route directly, which broke the project's own layer rule that controllers expose their own resource's URL space.

For symmetry, unblock also moves to a `userId`-keyed action: `DELETE /api/v1/users/{userId}/block`. Unblocking hard-deletes the `contacts` document entirely rather than restoring any prior status (there is no "previous status" field to restore from, and none is being added for this) — consistent with ADR 006's existing precedent that contact removal is a clean hard-delete, not a soft/reversible status change, and consistent with Instagram's confirmed behavior that unblocking does not automatically restore a prior follow relationship. If the two users want to reconnect after an unblock, that's a fresh connection request, same as after an unfriend.

---

## Drawbacks Acknowledged

- The upsert logic means `ContactService.blockUser()` has two code paths internally (update existing vs. create new) rather than one — slightly more surface area than a pure update would have, though this is routine service-layer branching, not a structural complexity concern.
- Because the new document created via the "stranger" path has no prior `PENDING`/`CONNECTED` history, a blocked stranger's `contacts` document looks identical in shape to one that started as a real connection and was later blocked — there is no field distinguishing "was never connected" from "was connected, then blocked." This is intentional (nothing in the product currently needs that distinction) but is a real information loss if a future feature ever wants to show "you blocked someone you were never connected to" differently.

---

## Evolution Path

If a future requirement needs to know whether a block originated from an existing relationship or a cold block (e.g., for abuse-pattern analytics, or a "review your blocks" UI that groups them differently), a `hadPriorRelationship: Boolean` snapshot field could be added to the `contacts` document at block-time without any migration, since it would simply be `false`/absent on all documents created before that field existed.

If Orbit ever needs to support blocking that survives an unblock/reblock cycle differently (e.g. repeated-blocking rate limiting, similar to Instagram's re-block cooldown), that would layer on top of this same endpoint rather than requiring a redesign.

---

## References

- ADR 006 (`006_contact_removal_strategy.md`) — the hard-delete precedent this decision's unblock behavior follows
- ADR 007 (`007_blocking_behavior.md`) — the original one-directional blocking behavior this decision extends the endpoint shape for
- Reference app research conducted during this decision (WhatsApp, Instagram, Signal blocking flows) — see backlog planning session, current as of July 2026