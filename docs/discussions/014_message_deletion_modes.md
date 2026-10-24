# 014 — Message Deletion Modes: Delete for Everyone vs Delete for Me

> **Format:** Architecture Decision Record (ADR)  
> **Reference:** https://adr.github.io  
> **Date:** 2026-10-24  
> **Status:** Accepted  

---

## Context

Requirement `P1-16` originally specified soft delete for direct messages: a user can delete a message they sent, replacing it with a placeholder for both participants indicating "This message was deleted" (`erd.md`, `API_CONTRACTS.md`, `message_status.md`).

However, users also need personal control over their chat history without altering the conversation for the counterparty. In reference applications such as WhatsApp, two distinct deletion modes exist:
1. **Delete for Everyone**: Revokes message content globally across all participants, leaving a placeholder. Only permitted for the message sender (or group admin).
2. **Delete for Me**: Clears the message exclusively from the deleting user's view, removing the card entirely without leaving a placeholder. Available for both sent and received messages to any conversation participant.

This surfaced during the design of story `ORDM-47` (Edit & Delete Own Message).

---

## Options Considered

### Option A — "Delete for Everyone" Only (Original Baseline)
Only provide global soft deletion. When a message is deleted, it is updated to `deleted: true, content: null`, and both participants see "This message was deleted".

**Pros:**
- Minimal schema requirements (single boolean `deleted` flag).
- Single code path for deletion.

**Cons:**
- Users cannot remove unwanted or sensitive received messages from their own screen.
- A user cannot clean up their own view without alerting the other party that a message was deleted.
- Fails user expectations established by standard messaging applications.

### Option B — Client-Side Local Hiding for "Delete for Me"
"Delete for everyone" updates MongoDB. "Delete for me" stores hidden message IDs in client-side storage (e.g. `localStorage` or IndexedDB).

**Pros:**
- No database schema changes for per-user deletion.

**Cons:**
- Not durable across devices or browser sessions.
- Inconsistent with Orbit's server-authoritative architecture.
- Re-fetching history after cache clearing or login from another client would resurrect deleted messages.

### Option C — Server-Authoritative Dual Deletion via `deletedFor` Array (Chosen)
Maintain a `deletedFor: [ObjectId]` array on both `messages` and `blockedMessages` collections.
- `DELETE .../messages/{id}?mode=FOR_EVERYONE`:
  - Permitted only for the sender (or group admin).
  - Sets `deleted: true`, `content: null`, `file: null` (per ADR 011).
  - Sets `conversations.lastMessage.content` to `"This message was deleted"` if it was the last message.
  - Broadcasts `{ messageId }` to `/topic/conversations/{id}/messages/deleted`.
  - In chat thread view, viewer-relative placeholders are rendered: the sender sees *"You deleted this message."* while counterparty participants see *"This message was deleted."*.
- `DELETE .../messages/{id}?mode=FOR_ME`:
  - Permitted for any participant in the conversation (sender or recipient).
  - Performs an atomic `$addToSet` of the requester's `userId` into `deletedFor`.
  - No WebSocket broadcast to the conversation topic.
  - History queries filter out messages where `deletedFor` contains the viewing user (`{ deletedFor: { $ne: currentUserId } }`).
  - The message completely disappears from the user's view.
  - If the message was unread by the user, it is marked as read to prevent orphaned unread badge counts.

**Pros:**
- Fully server-authoritative and synchronized across all client sessions and devices.
- Retains complete multi-user integrity without altering the other party's view.
- Reuses the existing message document without duplicating collections.

**Cons:**
- History query requires checking `deletedFor: { $ne: currentUserId }`.
- Compound index `{ conversationId: 1, deletedFor: 1, createdAt: -1 }` required for optimized queries.

---

## Decision

**Option C.** Implement both deletion modes with server-side enforcement:

1. **Schema Extension**:
   - `messages` and `blockedMessages` documents include `deletedFor: [ObjectId]`, defaulting to `[]`.
2. **Endpoint Contract**:
   - `DELETE /api/v1/conversations/{conversationId}/messages/{messageId}?mode=FOR_EVERYONE|FOR_ME` (defaults to `FOR_EVERYONE` if omitted and requester is the sender).
3. **Permissions**:
   - `FOR_EVERYONE`: Requester must be `senderId` (or group admin). Returns `403 Forbidden` if called on someone else's message.
   - `FOR_ME`: Requester must be a participant of the conversation.
4. **Real-Time Notifications**:
   - `FOR_EVERYONE` publishes to Kafka and fans out to `/topic/conversations/{id}/messages/deleted`.
   - `FOR_ME` performs no public WebSocket broadcast.
5. **Last Message Snapshot Fallback**:
   - When a message is deleted for everyone, `conversations.lastMessage.content` updates to `"This message was deleted"`.
   - When a message is deleted for me, the shared `Conversation` document remains intact for the other participant. For the user who deleted it, their history view and conversation list resolve the latest message that is not present in their `deletedFor` list.
6. **Unread Counts**:
   - If an unread message is deleted for me by the recipient, unread count for that conversation is decremented or marked read.

---

## References

- `docs/architecture/erd.md` — `messages` and `blockedMessages` schema
- `docs/API_CONTRACTS.md` — `DELETE /api/v1/conversations/{conversationId}/messages/{messageId}`
- `docs/state_machines/message_status.md` — message status transitions
- `docs/discussions/011_message_attachment_cleanup_on_delete.md` — R2 purge ordering on delete
