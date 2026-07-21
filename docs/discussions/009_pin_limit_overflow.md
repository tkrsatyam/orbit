# 009 — What Happens When a Group Hits Its Pin Limit

> **Format:** Architecture Decision Record (ADR)
> **Reference:** https://adr.github.io
> **Date:** 2026-07-20
> **Status:** Accepted

---

## Context

`erd.md` caps `pinnedMessages` at 10 entries per group, and `API_CONTRACTS.md` documents pin/unpin as admin-only actions. Neither doc says what happens when an admin tries to pin an 11th message. This surfaced while writing the Phase 2 requirement description for P2-08 — the limit was clearly a deliberate design choice, but the boundary behavior around it was never decided.

This is a small decision, but it has to be made before P2-08 can be implemented: the service method either has somewhere to put the 11th pin, or it rejects the call, and those are two different code paths.

---

## What real apps do at their pin limit

Two chat products with meaningfully different pin models were checked, since it seemed worth knowing whether this even needs a novel answer:

- **WhatsApp** caps in-chat message pins (3 per conversation) and simply refuses further pins past the limit — the user has to unpin something first. There's no permission model here at all; any participant can pin.
- **Discord** caps pins per channel/DM (250, previously 50) and documents the same rule explicitly: once you hit the limit, you remove an existing pin before adding a new one. Discord *does* gate pinning behind a permission in servers, which is the closer analogue to Orbit's admin-only rule.

Interestingly, the only place an auto-evict-oldest behavior shows up at all is in third-party Discord bots built specifically because people were annoyed at having to manually manage the limit. That's a tell — it's a workaround for the platform's decision, not a competing default anyone actually ships.

---

## The two options

**Reject the 11th pin.** The admin gets an error and has to unpin something before pinning the new message. Trivial to implement — a single count check before the insert. Matches both reference points, and fits naturally with pinning already being a deliberate, admin-gated action rather than something automatic.

**Auto-evict the oldest pin.** Pinning an 11th message silently drops whichever pin is oldest to make room. Removes a small bit of friction for the admin, but it means the system is quietly deleting something a human specifically chose to keep — for content that's explicitly curated, that feels backwards. It also isn't how either reference app behaves by default.

---

## Decision

Reject. Attempting to pin an 11th message in a group returns an error; the admin has to unpin something first.

This is the cheaper option to build, it's what both reference apps do independently despite having very different permission models, and it keeps pinning consistent with how Orbit already treats it elsewhere — an explicit, low-frequency admin action rather than something the system manages on its own.

---

## What we're giving up

An admin who wants to pin an 11th message mid-conversation has to stop and make a call about what to remove, rather than the system just handling it. Ten is a small number, so this should surface rarely, but it's a real (if minor) point of friction that auto-eviction would have avoided.

---

## If this needs to change later

If 10 turns out to be too small in practice (unlikely for a portfolio-scale app, but worth naming), the fix is just raising the constant — it doesn't touch this decision. If a future version wants to soften the rejection into something friendlier, the natural next step is a UI affordance that shows the oldest pin and offers a one-tap "unpin & pin" action, without changing the underlying reject-based rule.

---

## References

- `docs/architecture/erd.md` — `groups.pinnedMessages`, 10-pin cap
- `docs/API_CONTRACTS.md` — pin/unpin endpoints, admin-only auth
- WhatsApp Help Center — message pinning limits
- Discord Pin Messages FAQ — pin limits and permission model
