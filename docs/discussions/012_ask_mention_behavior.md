# 012 — `@ask` Trigger Visibility and Group-Only Enforcement

> **Format:** Architecture Decision Record (ADR)  
> **Reference:** https://adr.github.io  
> **Date:** 2026-07-23  
> **Status:** Accepted

---

## Why This Came Up

While writing functional descriptions for the Phase 4 requirements, two things about `@ask` turned out to be under-specified in a way `/summary` wasn't:

1. `ai_feature_flow.md` says `/summary` is detected by the client and called "**instead of** the regular message send endpoint" — explicit that the slash command replaces a normal send. The equivalent line for `@ask` only says the client "detects the `@ask` mention and calls the ask endpoint" — it never says *instead of* anything. So it was genuinely unclear whether the user's question is posted to the group as an ordinary message (and the bot's answer arrives as a second, separate message), or whether — like `/summary` — it's swallowed entirely and only the answer appears.
2. Every product-facing doc (`FEATURES.md`, `REQUIREMENTS.md`, `ai_feature_flow.md`) describes `@ask` as something that happens "in a group," but `API_CONTRACTS.md` documents the endpoint with no conversation-type check at all — just "must be a participant." Nothing said whether "group-only" was a rule the backend actually enforces, or just an assumption baked into when the frontend happens to show the trigger.

Both questions needed an answer before the Phase 4 requirement descriptions could be written accurately, since they change what actually happens in the conversation when `@ask` is used.

---

## Question 1: Does the triggering message stay visible?

### What reference apps do

`/summary` and `@ask` look similar (both are "type something special, get a bot response") but they're actually two different, well-established chat UI conventions, and the conventions don't behave the same way in any mainstream platform:

- **Slash commands** (Slack's `/`, Discord's `/`) are a distinct interaction type. The command itself is consumed by the platform — it never appears in the channel as a message from the user. Only the resulting response (sometimes visible to everyone, sometimes only to the invoker) shows up as a message.
- **`@`-mentions of a bot** are not a distinct interaction type — they're a normal message that happens to contain a recognizable token. Slack's own event model reflects this directly: an `app_mention` event is delivered as a message-shaped payload, not a slash-command-shaped one, and the message stays in the channel exactly like any other message a human sent. Discord bots built around mention-triggers work the same way — the mention is an ordinary channel message, and the bot's reply is posted afterward as its own, separate message. Neither platform hides, consumes, or specially treats the triggering message.

So `/summary`'s "replace the send" behavior isn't actually the general pattern for bot interactions — it's specific to slash commands. `@ask` uses the other convention, and that convention's real-world precedent is unanimous: the message stays.

### Decision

**The user's message containing `@ask <question>` is sent through the exact same message send flow as any other group message** — persisted, broadcast, counted toward unread, subject to edit/delete like anything else. It is not intercepted, and `AiController`/`AiService` are never involved in creating it.

Separately, and in addition, the client also triggers the ask flow. The assistant's answer is generated and posted as a second, distinct message — attributed to the same bot identity used for `/summary` — appearing after the question in the conversation.

This means a group using `@ask` sees two messages where `/summary` produces one: the member's question (visible and ordinary, like anything else they type) and the bot's answer underneath it.

---

## Question 2: Where is "group-only" enforced?

### What reference apps do

None of the mainstream platforms rely on the client simply choosing not to send the request. They gate the behavior structurally, before the bot-handling code is even reached:

- **Slack** routes DM messages and channel mentions through *different event types* (`message.im` vs `app_mention`) at the platform level. An integration built to handle `app_mention` structurally cannot be invoked from a DM — there's no `if` check to bypass, because the DM case never reaches that code path at all.
- **Discord** bots that gate on mention commonly branch explicitly on context (guild channel vs. DM) inside their own message-handling logic, rather than assuming the invocation only ever arrives from where the UI suggests it should.
- **Microsoft Teams** bots declare valid scopes (`team`, `groupChat`, `personal`) in their manifest, and the platform itself refuses to deliver the interaction outside a declared scope — enforced before the bot's own code runs at all.

The common thread: scoping a mention-triggered feature to a particular conversation type is always enforced somewhere the client can't route around, not just reflected in what the UI happens to offer.

### Decision

**Enforced in both places, with the backend as the authority:**

- `AiService.ask()` checks the conversation's type before doing anything else. If the conversation is not a group, the request is rejected — the assistant never runs, no bot message is ever created, regardless of how the request arrived.
- The frontend's `AiCommandDetector` only treats `@ask` as a trigger when composing in a group. In a DM, `@ask ...` is just literal text sent as a normal message — the detector doesn't fire, so there's no confusing round-trip where a user gets a rejected request instead of a message that was simply never meant to do anything special there.

The backend check is the one that actually matters for correctness; the frontend behavior exists so a DM never produces a dead-end error for typing something that was never going to work.

---

## Combined Effect

Put together, using `@ask` in a group now behaves as:

1. Member types `@ask <question>` and sends it.
2. It's persisted and delivered exactly like any other group message — everyone sees the question as a normal message from that member.
3. The client also calls the ask flow. The backend confirms the conversation is a group, then generates an answer.
4. The answer is persisted and broadcast as a second message from the assistant identity, appearing after the question.

If the same text were typed in a DM, the detector never treats it as a trigger — it's sent as an ordinary message, and nothing else happens.

---

## Drawbacks Acknowledged

- Two messages instead of one changes the conversation's message count and read-receipt/unread accounting slightly compared to a hypothetical single-message design — this is a minor, accepted side effect of matching the mention convention rather than the slash-command one.
- The backend now needs conversation-type awareness inside `AiService`, which `/summary` and the other three AI features don't need — this is a small, feature-specific addition, not a shared concern across all five AI endpoints.
- This decision doesn't address what happens if `@ask` is used in a group that later becomes too large for the context window assumptions in `ai_feature_flow.md` (20 messages of context) — that's a separate, pre-existing scaling question untouched by this ADR.

---

## Evolution Path

If `@ask` is ever extended to DMs (e.g. "ask the assistant privately about this conversation"), the enforcement point identified here is exactly where that would change — a single check in `AiService.ask()`, plus removing the group restriction from `AiCommandDetector`. No other part of this decision would need to be revisited, since the "question stays visible, answer is a separate message" behavior already works identically for a two-party conversation as it does for a group.

---

## References

- `docs/architecture/sequences/ai_feature_flow.md` — Flow A (`/summary`) and Flow B (`@ask`), being updated to reflect this decision
- `docs/API_CONTRACTS.md` — `POST /api/v1/ai/ask`, being updated with the group-only enforcement note
- `docs/FEATURES.md` — AI Assistant Bot feature description, being updated
- `docs/REQUIREMENTS.md` — P4-03, P4-04
- Slack Events API — `app_mention` vs `message.im` event separation
- Slack Events API — slash command vs. event-based mention handling
- Discord bot mention-handling conventions (community-documented patterns; no single canonical spec, but consistent behavior across implementations)
- Microsoft Teams bot manifest scopes (`team`, `groupChat`, `personal`)