# 007 — Blocking Behavior: Visibility, Messaging, and Presence

> **Format:** Architecture Decision Record (ADR)
> **Reference:** https://adr.github.io
> **Date:** 2026-07-18
> **Status:** Accepted

---

## Context

`contacts.status` already models `BLOCKED` as a persistent status (see ADR 006), and blocking is already known to prevent re-requesting and messaging. What was never specified was the *full* behavioral surface of a block: what a blocked user (B) can and cannot see or do with respect to the user who blocked them (A), what A can and cannot see of B, how this interacts with groups, and — most significantly — what happens to a message B sends to A after being blocked, given the project's core "persist before publish" rule.

This surfaced while writing functional descriptions for the Phase 1 Contacts and Direct Messages requirements in `docs/REQUIREMENTS.md`. None of `erd.md`, `API_CONTRACTS.md`, `BACKEND_STRUCTURE.md`, or `FRONTEND_STRUCTURE.md` address blocking beyond "no re-request, no messaging, hidden from search" — profile-lookup-by-ID, presence, display name, groups, and message persistence during a block were all unspecified.

To ground the decision, behavior was researched across three real-world reference apps with different architectural shapes: WhatsApp (phone-number identity, local-first client storage), Instagram (username/content-platform identity), and Signal (phone-number identity with an optional username overlay, minimal server-side metadata). Orbit's shape — a professional messaging tool with no public content feed, and a server-authoritative client with no local persistent message store — was used to judge which precedent applies where the three references disagree.

---

## Options Considered

For each sub-decision, the realistic options are listed. Where only one reasonable option existed given Orbit's existing architecture, it is noted as such rather than presented as a false choice.

### 1. Presence and profile detail visibility (last seen, online status, avatar)

- **Option A — Hidden from B only, A retains full visibility (chosen).** Matches WhatsApp's documented behavior exactly: a blocked contact loses visibility into your last seen, online status, and profile photo changes, while you continue to see theirs. Blocking is framed as "stop being seen/reached," not "stop seeing."
- **Option B — Mutually hidden.** Neither party sees the other's presence. Rejected — no reference app does this, and it protects nothing A needs protected, since A initiated the block deliberately and has no exposure to hide from themselves.

### 2. Display name masking

- **Option A — No masking; underlying data is unaffected (initial position).** Orbit has no equivalent of WhatsApp's locally-owned contact name, so this seemed initially out of scope.
- **Option B — Mask A's real name behind a generic placeholder in B's view only (chosen).** Confirmed as current Instagram behavior: a blocked user's DM thread shows "Instagram User" instead of the real name/username, specifically so the blocked person cannot identify who blocked them. Since Orbit's `displayName` is a field the platform owns (unlike WhatsApp's device-local contact names), this pattern is directly applicable. Masking is one-directional — A continues to see B's real name.

### 3. Profile lookup by ID

- **Option A — Unrestricted; block only affects search visibility (initial position).** Simplest, matches WhatsApp, which has no separate profile-by-ID concept to restrict.
- **Option B — Fully restricted, returning a generic "profile unavailable" response rather than a raw 403/404 (chosen).** Confirmed as current Instagram behavior: even a direct link/URL to a blocked user's profile returns an unavailable/not-found page, not just an absence from search. Chosen for consistency with Decision 2 — masking the name in message threads while leaving the full profile openly fetchable by ID would be an internally inconsistent design.

### 4. Messaging — B's messages after being blocked

This was the central open question, given the project's non-negotiable "persist before publish" rule (`docs/architecture/erd.md`, `docs/BACKEND_STRUCTURE.md`).

- **Option A — Reject at the API boundary; nothing is persisted anywhere.** Matches WhatsApp's server behavior most literally — a blocked contact's messages are discarded by WhatsApp's servers and never queued for later delivery. Rejected as the final design because Orbit's frontend is server-authoritative with no local persistent message store (`FRONTEND_STRUCTURE.md`); B's "sent" message would vanish on refresh or reconnect, which is a worse and more confusing experience than the WhatsApp behavior it was meant to imitate, not an equivalent of it.
- **Option B (as a flag) — Persist to the existing `messages` collection with a hidden/undeliverable flag.** Rejected: this requires every current and future read path over `messages` — conversation history, unread counts, Phase 3 search, Phase 4 AI summary — to remember to filter on this flag indefinitely. This is an open-ended, easy-to-forget cost with no natural enforcement mechanism.
- **Option B (as a separate collection) — Persist to a dedicated `blockedMessages` collection (chosen).** Gets WhatsApp-equivalent durability (B's message survives refresh/reconnect, rendered identically to a normal sent message) without the recurring filtering cost of the flag approach, because no existing or future feature has any reason to query a collection it doesn't know exists. The separation is structural, not conditional — nothing needs to "remember" anything.

### 5. Composer availability for A (the blocker)

- **Option A — Same as B; A can attempt to send, silently fails.** Rejected — A already knows they blocked B; there is no reason to let A go through the motions of a send that will never work.
- **Option B — Composer disabled/hidden client-side for A when viewing a blocked conversation (chosen).** Matches WhatsApp, where the blocker's chat UI replaces the input with an unblock prompt rather than a working composer.

### 6. Group messaging and group presence

- **Option A — Blocking reaches into shared groups (message delivery and/or presence suppressed for all shared-group contexts).** Rejected for message delivery — confirmed that WhatsApp explicitly does not suppress group messages between blocked users: blocking a contact won't stop that user from seeing your messages in a group you both participate in. Implementing this in Orbit would require a cross-collection check (`contacts.status` against every group message send) that the existing architecture doesn't otherwise need, for behavior no reference app implements.
- **Option B — Group messaging fully unaffected; group presence display follows the same 1:1 suppression rule (chosen).** Confirmed as WhatsApp's actual split: message delivery is untouched in shared groups, but presence suppression still applies — a blocked user still can't see if you're online, specifically, even inside a group context. This is a narrow, contained addition to group member-list rendering, not a change to message flow.

### 7. Unblock behavior

- **Option A — Blocked-out messages are released/delivered retroactively on unblock.** Rejected — no reference app does this; WhatsApp's blocked messages are discarded outright, not queued, so there is nothing to release later.
- **Option B — Permanent; `blockedMessages` documents never migrate to `messages`, even after unblock (chosen).** Matches WhatsApp exactly and requires no reconciliation logic on unblock.

### 8. Typing indicator during a block

- **Option A — Unaffected; typing indicator fires normally to A.** Rejected as inconsistent with every other one-directional signal already decided (presence, profile, messaging).
- **Option B — Suppressed, B → A (chosen).** Consistent with Decisions 1 and 6. Requires its own explicit check in the typing-indicator WebSocket path (`docs/architecture/sequences/presence_flow.md`), since it is a separate destination from message send and does not automatically inherit the message-send fix.

### 9. Phase 3 message search over `blockedMessages`

- **Option A — Leave `blockedMessages` unindexed for text search; accept that B's blocked-out messages are unsearchable.** Would be a silent, undesirable inconsistency — B could see a blocked-out message in scrollback but not find it via search, for no principled reason.
- **Option B — Add the same compound text index to `blockedMessages` now, so Phase 3's search endpoint can merge both collections the same way `GET .../messages` already does (chosen).** The index is added at schema-definition time in this ADR; the search endpoint itself remains Phase 3 scope (`P3-03`), per the project rule that Phase 2/3 work does not begin until Phase 1 is fully deployed. This avoids a retrofit later.

---

## Decision

Orbit's blocking model is **asymmetric by design**: A (the blocker) retains full visibility into B and is fully protected from B, while B loses visibility into A and cannot reach A, without ever being told a block has occurred. Concretely:

- **Visibility (1:1):** B loses A's last seen, online status, avatar, and real display name (masked to a generic placeholder). A's visibility into B is completely unaffected.
- **Profile lookup:** Fetching A's profile by ID returns a generic "profile unavailable" response when the requester is blocked, consistent with the name-masking decision.
- **Messaging:** B's messages to A are persisted to a new `blockedMessages` collection — not `messages` — with the identical schema shape (including `file`, `reactions`, `edited`/`deleted`, `quotedMessage`, and a scoped compound text index), minus `readBy`, which has no possible value in a document only its own sender will ever see. The API response to B is indistinguishable from a normal successful send. Nothing is ever published to Kafka for these messages, and nothing ever migrates from `blockedMessages` to `messages`, including after unblock.
- **Reads:** `GET .../messages` (and, in Phase 3, message search) merge `messages` with `blockedMessages` scoped strictly to `senderId == requester`. This scoping is what keeps A from ever seeing B's echoed messages — no additional flag or block-status check is needed at read time, because the scoping rule itself is the filter.
- **Edit/delete/react:** These operations on a blocked-out message check both `messages` and `blockedMessages` when locating the message by ID. This is a bounded, fixed addition to three existing methods, not an open-ended cost.
- **Composer UI:** A's message composer is disabled/hidden client-side when viewing a blocked conversation. B's composer behaves identically to normal.
- **Groups:** Message delivery in shared groups is completely unaffected by a 1:1 block between two members. Presence display is the one exception — A's online status remains hidden from B even inside a shared group's member list.
- **Typing indicators:** Suppressed from B to A, consistent with all other one-directional signals.

The `blockedMessages` collection was chosen over a hidden-flag-on-`messages` approach specifically because it converts an easy-to-forget behavioral rule ("remember to filter this everywhere") into a structural fact ("this data lives somewhere else"). No current or future feature — search, unread counts, the Phase 4 AI summary bot — needs to know this collection exists, because none of them have any reason to query it.

---

## Drawbacks Acknowledged

- `blockedMessages` duplicates most of the `messages` schema, which is some genuine schema surface for a narrow edge case.
- Edit, delete, and react operations now require a two-collection lookup by message ID, rather than a single-collection lookup.
- Phase 3 search requires its own merge logic in addition to the one already built for conversation history — not automatically inherited, must be implemented deliberately when Phase 3 begins.
- Display-name masking and full profile-lookup restriction are Instagram-derived patterns with no WhatsApp equivalent; they are a deliberate design choice for Orbit rather than a behavior ported directly from a single reference app.
- This ADR does not resolve every possible edge case discovered during implementation — for example, whether a quoted reply to an already-blocked-out message behaves correctly across the two collections was raised but not fully explored. Such gaps are expected to surface during implementation and should be handled as small follow-ups rather than treated as a sign this design pass was incomplete.

---

## Evolution Path

If a future requirement needs blocked-message data to be recoverable (e.g. a moderation or "review before unblocking" feature), `blockedMessages` already exists as a clean, isolated collection — no schema migration would be needed, only a new read path exposing it under different rules. If Orbit ever needs symmetric blocking (mutual invisibility) for some future product reason, Decision 1 and Decision 6 would need to be revisited together, since they currently share the same one-directional-suppression rule by design.

---

## References

- `docs/architecture/erd.md` — `messages` collection schema, to be extended with `blockedMessages`
- `docs/API_CONTRACTS.md` — `GET /api/v1/users/search`, `GET /api/v1/users/{userId}`, `GET /api/v1/conversations/{conversationId}/messages`, `GET /api/v1/search/messages` (Phase 3)
- `docs/BACKEND_STRUCTURE.md` — `message` and `contact` package layouts; persist-before-publish rule
- `docs/architecture/sequences/message_send_flow.md` — R2-upload-before-persist rule for file/image messages
- `docs/architecture/sequences/presence_flow.md` — typing indicator and presence WebSocket destinations
- ADR 006 — `docs/discussions/006_contact_removal_strategy.md` — establishes `BLOCKED` as the only persistent, enforcement-driven status in `contacts`
- WhatsApp Help Center — blocking behavior (presence, messaging, group exceptions)
- Instagram Help Center — blocking behavior (profile/content visibility, name masking in DM threads)
- Signal — username-as-optional-overlay identity model, referenced for comparison only; no direct behavioral precedent applied
