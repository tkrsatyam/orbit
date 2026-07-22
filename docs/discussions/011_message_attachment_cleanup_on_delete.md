# 011 — Message Attachment Cleanup on Delete

> **Format:** Architecture Decision Record (ADR)  
> **Reference:** https://adr.github.io  
> **Date:** 2026-07-22  
> **Status:** Accepted  

---

## Context

Soft delete is already fully specified for messages: `deleted` is set to `true`, `content` is set to `null`, and the document itself is preserved so the conversation still reads naturally and shows "This message was deleted" (`erd.md`, `API_CONTRACTS.md`). This rule was written with `TEXT` messages in mind.

Phase 3 introduces `IMAGE` and `FILE` message types, each carrying a `file` object that points at an object stored in Cloudflare R2. None of `erd.md`, `API_CONTRACTS.md`, or `BACKEND_STRUCTURE.md` say what happens to that R2 object when the message referencing it is soft-deleted, or when a whole conversation is hard-deleted. The only existing precedent for deleting anything from R2 is avatar replacement, which deletes the old avatar object but doesn't establish an ordering rule, and isn't obviously the same situation — an avatar has exactly one owner-document at a time, while a deleted message is still displayed as a placeholder, so it wasn't obvious the file *should* disappear just because the deleted flag was set.

This surfaced while writing functional descriptions for the Phase 3 Search & Files requirements in `docs/REQUIREMENTS.md`.

To ground the decision, behavior was researched across three real reference apps: WhatsApp, Signal, and Slack.

---

## Options Considered

### Option A — Leave the R2 object untouched on message delete
The message document is soft-deleted as normal; the underlying file in R2 is never separately cleaned up.

**Pros:**
- No new code, no new failure mode.
- Coincidentally matches the *outcome* (though not the mechanism) of WhatsApp and Signal, both of which are documented to leave stray copies of deleted media behind on recipient devices.

**Cons:**
- WhatsApp and Signal's leftover copies are a side effect of both apps being local-first — the phone, not a server, is the durable copy, so there's no central place to clean up in the first place. Orbit has no equivalent: the R2 object is the only durable copy, so leaving it behind is a deliberate choice to accumulate storage, not an architectural inevitability like it is for those two apps.
- Orbit runs on a free-tier R2 bucket. Orphaned files accumulate indefinitely with no natural ceiling.

### Option B — Purge the R2 object immediately on message soft-delete (chosen)
When a message of type `IMAGE` or `FILE` is soft-deleted, the message document is updated as usual (`deleted: true`, `content: null`) and the `file` object on that document is also set to `null`, and the corresponding object in R2 is deleted at the same time.

**Pros:**
- Reuses a pattern Orbit already has, rather than inventing a new one — this is exactly what avatar replacement already does (old file deleted from R2 the moment it's superseded).
- No read path is put at risk: a deleted message already renders as a placeholder everywhere in the app, so nothing ever tries to re-fetch `file.url` for a deleted message.
- Frees storage immediately, which matters more on a free-tier bucket than it would on paid infrastructure.
- Closest match to Slack's shape, which is the one reference app of the three that is also server-authoritative rather than local-first: Slack ties a deleted message to removal of its attached files from the channel, and treats the file object as independently deletable, which is structurally the same shape as Orbit's `file` field.

**Cons:**
- The message document's `file` field becomes `null` after delete, which is a small schema-level addition to the existing "content becomes null on delete" rule — anything that reads `file` off a message must already be checking `deleted` first, the same as it already must be for `content`.
- If the R2 delete call fails after the MongoDB update succeeds, the object is orphaned in storage with no document pointing at it. This is treated as an acceptable, low-frequency failure mode (see Decision below) rather than something requiring a retry queue.

### Option C — Deferred purge on a retention window (Slack's actual model)
Keep the R2 object for a configurable grace period after soft-delete, then purge it via a scheduled sweep — mirroring Slack's workspace-configurable file retention, where deleted files are held for a period before being permanently purged.

**Pros:**
- Would allow recovery of an accidentally-deleted attachment within the grace window.
- Matches Slack's actual behavior most closely, not just its shape.

**Cons:**
- Requires new infrastructure Orbit has no precedent for. Nothing in the codebase runs on a schedule today — `MigrationService` and `DataInitializer` both run once, at application startup, not periodically. A retention sweep would need its own scheduled job, which is a meaningfully larger addition than a one-line R2 delete call.
- Slack's retention window exists to satisfy workspace compliance/legal requirements. Orbit has no equivalent driver — there's no stakeholder asking for a grace period, so the added complexity has no requirement pulling it in.
- Rejected as disproportionate to the problem for a portfolio-scale project.

---

## Decision

**Option B.** When a message of type `IMAGE` or `FILE` is soft-deleted:

1. The message document is updated first: `deleted: true`, `content: null` (already-established behavior), and `file: null` (new).
2. The R2 object referenced by that message's `file.fileId` is then deleted.

The MongoDB update happens before the R2 delete call, deliberately mirroring the reasoning behind persist-before-publish elsewhere in the project: if the second step fails, the failure mode should be the recoverable one. Here, that means an orphaned file sitting harmlessly in R2 with nothing pointing at it, rather than a message document that still references a file object that no longer exists. The reverse ordering would risk exactly that broken state if the MongoDB update failed after the R2 object was already gone.

This extends unchanged to conversation and group hard-delete: since all messages in a deleted conversation are already hard-deleted in batches (`erd.md`), each batch step additionally deletes the R2 object for any `IMAGE`/`FILE` message in that batch, using the same `R2StorageClient.delete()` call.

Signal and WhatsApp were both considered and set aside as precedent for this specific decision, since neither is server-authoritative — their "leftover media" behavior is a side effect of local-first storage, not a deliberate retention design, so there's no real design to port from them here. Slack's decoupling of "message hidden from the channel" from "file purged from storage" is the applicable shape, and Option B adopts that decoupling without adopting Slack's compliance-driven retention window, since Orbit has no requirement driving one.

---

## Drawbacks Acknowledged

- `file` joins `content` as a second field that becomes `null` on delete — every message read path already has to check `deleted` before trusting `content`; it now also has to do the same before trusting `file`. This is a bounded addition to an existing pattern, not a new category of check.
- An R2 delete failure after the MongoDB update leaves an orphaned object in storage with no automated cleanup. This is accepted as a low-frequency, low-cost failure mode rather than solved with retry infrastructure, consistent with Option C being rejected as disproportionate.
- Once deleted, an accidentally-removed attachment cannot be recovered — there is no grace window, unlike Slack's retention-window model. This is a deliberate tradeoff against added scheduling infrastructure, not an oversight.

---

## Evolution Path

If Orbit ever needs recoverable deletion (e.g. an "undo delete" affordance within a short window), Option C's shape would need to be revisited — likely as a grace-period flag on the message rather than immediate `file: null`, with a scheduled sweep doing the actual R2 purge after the window closes. That would be a meaningfully larger change, not an incremental extension of this decision, so it should be its own future ADR rather than assumed to be a small follow-up to this one.

---

## References

- `docs/architecture/erd.md` — `messages` collection schema and soft-delete integrity rule, to be extended with the `file: null` behavior
- `docs/API_CONTRACTS.md` — `DELETE /api/v1/conversations/{conversationId}/messages/{messageId}`
- `docs/BACKEND_STRUCTURE.md` — `MessageService`, `R2StorageClient`; existing avatar-replacement R2 delete precedent
- `docs/state_machines/message_status.md` — `DELETED` state's MongoDB field list and the MongoDB Document Representation summary, both extended with `file: null`; `docs/architecture/diagrams/message_status.svg` updated to match
- WhatsApp Help Center / researcher disclosure — inconsistent leftover-media behavior across platforms, cited as a side effect of local-first storage rather than a deliberate design
- Signal Support — local-first storage model; deleting a message or chat does not affect the other party's device
- Slack Help Center / API docs — message deletion removes attached files from the channel; files are independently deletable; retention settings decouple "hidden" from "purged"
