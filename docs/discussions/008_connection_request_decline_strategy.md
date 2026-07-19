# 008 — Connection Request Decline Strategy: Delete vs Persist

> **Format:** Architecture Decision Record (ADR)  
> **Reference:** https://adr.github.io  
> **Date:** 2026-07-20  
> **Status:** Accepted

---

## Context

`erd.md`'s Service Layer Integrity Checklist fully specifies the `ACCEPT` path for a connection request: `contacts.status` moves to `CONNECTED`, a DM conversation is created, `contacts.conversationId` is populated, and a notification is seeded for both users — all as one transaction. The `DECLINE` half of the same action is never given equivalent treatment anywhere in the docs — `API_CONTRACTS.md` and `BACKEND_STRUCTURE.md` both mention it only as the other value of an `ACCEPT | DECLINE` enum, with no description of what happens to the `contacts` document afterward.

This surfaced while writing the functional description for `P1-10` in `docs/REQUIREMENTS.md`.

ADR 006 already decided the adjacent question of what happens to a `contacts` document when an *existing, mutual* `CONNECTED` relationship ends (unfriend): hard-delete, no `REMOVED` status, no persisted history. That reasoning doesn't automatically transfer here — unfriending dissolves a relationship both users already agreed to; declining rejects a relationship only one user (the requester) ever wanted. The two are adjacent, not identical, so the precedent was checked rather than assumed to cover this case, per the project's process for handling underspecified behavior.

To ground the decision, behavior was researched across four real-world reference apps with an explicit request → respond flow: Instagram (follow requests), Signal (message requests), LinkedIn (connection requests), and Discord (friend requests). WhatsApp — one of the three apps used in ADR 007 — was excluded here since it has no request/approval concept at all; any phone-number contact can message directly. LinkedIn was added specifically because, unlike Instagram's asymmetric follow, a LinkedIn connection is a mutual, bidirectional relationship that gates messaging — the closest structural match to Orbit's `contacts` model among mainstream apps.

---

## Options Considered

### Option 1 — Persist a `DECLINED` status
Add a fourth (or fifth, alongside `BLOCKED`) enum value on `contacts.status`, set on decline instead of deleting the document. Could be used to add friction to immediate re-requesting.

**Pros:**
- Preserves a record that a request was made and rejected
- Opens the door to a future cooldown-before-retry rule, if repeat/spam requests ever become a real problem

**Cons:**
- No reference app pairs a plain decline with any lasting restriction. Instagram's Help Center is explicit that a denied requester "can ask the person to request to follow you again." Discord's own support team, when asked by users to add exactly this friction, pointed people at the block feature instead of building it into decline. LinkedIn's Ignore is silent and non-restrictive; a harsher, opt-in escalation ("I don't know this person") exists separately for when a user actually wants to shut a sender out. Signal draws the same line explicitly at the product level: "delete" is reversible and non-punitive, "block" is permanent — two distinct actions, not two strengths of the same action.
- Reopens exactly the cost ADR 006 rejected for the unfriend case: a larger enum, status-filtered "are these users connected" queries, and loosened uniqueness handling on `{ requesterId, receiverId }`
- No feature in `FEATURES.md` currently needs decline history or a re-request cooldown

### Option 2 — Hard delete on decline (chosen)
On decline, the `contacts` document is deleted entirely — the same mechanism ADR 006 already established for unfriend. The requester is not notified. A future request from the same requester to the same receiver is unrestricted.

**Pros:**
- Matches the converging behavior of Instagram, Signal, LinkedIn, and Discord: a plain decline/ignore is soft, silent, and non-restrictive everywhere it was checked
- Keeps `contacts.status` exactly as large as ADR 006 already scoped it — `PENDING | CONNECTED | BLOCKED`, nothing added
- No new index or query-shape changes; the existing unique compound index on `{ requesterId, receiverId }` continues to work as-is
- Orbit already has a real, permanent enforcement tool for the case where a user actually wants to stop hearing from someone — `BLOCKED` (`P1-12`). Decline doesn't need to be a weaker substitute for it, since the real tool already exists.

**Cons:**
- No record if a request is declined and re-sent later — the second request is indistinguishable from a first attempt
- A user who finds repeat requests from the same person annoying has no softer tool between "ignore and hope they don't try again" and blocking outright

---

## Decision

Orbit hard-deletes the `contacts` document on decline — identical mechanism to the unfriend/remove case in ADR 006. No `DECLINED` status is introduced. The requester receives no notification that they were declined, consistent with the silent, one-directional tone already established for `BLOCKED` in ADR 007. A new request from the same requester to the same receiver is unrestricted and can be sent immediately.

This keeps enforcement concentrated exactly where the project's stated philosophy says it belongs: nothing in Orbit should behave restrictively by default — restriction is reserved for the one status that actually needs it, `BLOCKED`. Every reference app checked draws that same line at the same place: a plain decline never carries lasting weight; only a deliberate, separate block action does.

---

## Drawbacks Acknowledged

- If the same requester re-sends a declined request repeatedly, there is currently no lighter-weight tool to stop it short of blocking them outright. LinkedIn's "I don't know this person" and Discord's pointer-to-block both show real apps hit this same gap and resolved it the same way — direct the user to block.
- No audit trail exists if a request is declined and later reconsidered by either side.

---

## Evolution Path

If repeat/spam re-requesting after a decline becomes a real product problem, the recommended approach is a lightweight, time-boxed rate limit on request creation (e.g., "same requester, same receiver, N-minute cooldown") rather than retrofitting a persisted `DECLINED` status — this avoids reopening the enum and query-shape costs Option 1 was rejected for. `BLOCKED` remains the tool of record for a user who wants a sender stopped permanently.

---

## References

- `docs/architecture/erd.md` — `contacts` collection schema, `ACCEPT` transaction, and unfriend/remove integrity rule
- `docs/API_CONTRACTS.md` — `PATCH /api/v1/contacts/requests/{requestId}`
- `docs/REQUIREMENTS.md` — `P1-10`
- ADR 006 — `docs/discussions/006_contact_removal_strategy.md` — establishes hard-delete as the default for non-enforcement-bearing `contacts` states
- ADR 007 — `docs/discussions/007_blocking_behavior.md` — establishes the silent, one-directional tone for actions the other party isn't notified of
- Instagram Help Center — follow request approve/deny behavior
- Signal Support — message request delete vs. block distinction
- LinkedIn Help — accept/ignore/report invitations behavior
- Discord Support Community — friend request decline behavior and community requests for stronger enforcement