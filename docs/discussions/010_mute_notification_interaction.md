# 010 — Does Muting a Conversation Affect the Unread Badge?

> **Format:** Architecture Decision Record (ADR)
> **Reference:** https://adr.github.io
> **Date:** 2026-07-20
> **Status:** Accepted

---

## Context

Phase 2 introduces three things at once: muting a conversation (P2-09), a live-updating unread badge (P2-03), and browser desktop notifications (P2-04). Nothing in `FEATURES.md`, `erd.md`, or `API_CONTRACTS.md` says how mute relates to the other two — it's documented purely as "stops prompting the user," which is vague enough to mean either "no more desktop popups" or "this conversation no longer counts as unread at all."

This matters architecturally, not just cosmetically: `message_send_flow.md` already documents that the unread-count upsert (step 4 of the send flow) runs unconditionally for every participant except the sender. Whatever gets decided here either leaves that step untouched or requires adding a new conditional to a path that currently has none.

---

## Looking at how other tools split this

Three products were checked, chosen because they land in different places:

- **Slack** keeps the unread count visible on a muted channel — muting only stops the bold highlighting and the push notification. Slack's own framing is "don't interrupt me," not "hide that something happened." You can still glance at the sidebar and know you're behind on something.
- **WhatsApp** used to work the same way, but changed: muted chats no longer increment the app-level badge either. The stated reasoning was that a badge defeats the point of muting in the first place.
- **Zulip**, built for high-volume group workspaces, goes furthest — muted topics don't count toward unread totals anywhere in the app, not just the OS-level badge.

These disagree because they're solving different problems. Slack is optimizing for "don't let me lose track of things I'm technically in." WhatsApp and Zulip are optimizing for "let me actually opt out." Neither is wrong, they're just different products.

---

## The cost side turned out to matter more than the UX side

Once the reference apps were mapped to real implementation cost inside Orbit's architecture, the decision got easier:

- Making the badge respect mute (the WhatsApp/Zulip direction) means adding a mute check into `MessageService`'s notification upsert — a path that today runs the same way for every participant, mute or not. That's new backend logic in a currently-unconditional step.
- Making *only* the desktop notification respect mute (the Slack direction) costs nothing on the backend. The frontend already has each conversation's `muted` flag from the conversation list response — the desktop notification is fired client-side off the incoming WebSocket event, so it's one added check at a point that already exists.

So the cheaper option and the option that avoids touching a rule the project treats as foundational (persist-and-count-first, notify second) happen to be the same option.

---

## Decision

Muting a conversation suppresses desktop notifications for it. It does not change how the unread badge is computed or pushed — that keeps working exactly as Phase 2 already specifies for every other conversation, muted or not.

Concretely: the notification-count upsert in the message send flow stays unconditional, as documented. The only new logic is client-side — before firing a desktop notification, check the conversation's muted state (already available in the frontend's conversation list data) and skip the notification if true.

---

## What we're giving up

A muted conversation still visibly increments its badge, so a user who mutes a noisy group chat to stop the popups will still see its unread count climbing in the sidebar. For someone expecting WhatsApp's current behavior — mute meaning "I don't want to know at all" — this might feel incomplete. It's a deliberate tradeoff: Orbit is following Slack's model here (quiet, not invisible), not WhatsApp's.

---

## If this needs to change later

If feedback (real or hypothetical, for a portfolio project) suggests people expect mute to also hide the badge, that's a separate, additive decision — not a reversal of this one. It would most naturally show up as a second, optional setting layered on top of the existing mute flag (something like a "fully hide" toggle), rather than changing what plain mute does by default.

---

## References

- `docs/architecture/sequences/message_send_flow.md` — step 4, unconditional notification upsert
- `docs/architecture/erd.md` — `conversations.mutedBy`, `notifications` collection
- `docs/API_CONTRACTS.md` — mute/unmute endpoint, conversation list `muted` field
- Slack Help Center — channel mute behavior and unread counts
- WhatsApp — muted chat badge behavior change
- Zulip Help Center — muted topic/stream unread behavior
