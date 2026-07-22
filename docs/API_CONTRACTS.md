# API Contracts

This document defines all REST endpoints and WebSocket
destinations for Orbit's backend.

---

## Conventions

### Base URL

Local:      http://localhost:8080  
Production: https://api.orbit.onrender.com   (update when deployed)

### Authentication

All protected endpoints require a Bearer token in the
Authorization header:

    Authorization: Bearer <access_token>

### Request / Response Format

- All request and response bodies are JSON
- Content-Type: application/json on all requests with a body
- Timestamps are ISO 8601 UTC strings: 2026-06-27T10:30:00Z
- MongoDB document IDs are returned as strings

### HTTP Status Codes

| Code | Meaning                                               |
|------|-------------------------------------------------------|
| 200  | Success with response body                            |
| 201  | Resource created successfully                         |
| 204  | Success with no response body                         |
| 400  | Validation error — malformed request or invalid field |
| 401  | Missing or invalid access token                       |
| 403  | Valid token but insufficient permission               |
| 404  | Resource not found                                    |
| 409  | Conflict — duplicate resource                         |
| 429  | Rate limit exceeded                                   |
| 500  | Internal server error                                 |

### Error Response Format

All error responses follow a consistent envelope:

    {
      "status": 400,
      "error": "Bad Request",
      "message": "Display name must be between 2 and 50 characters",
      "path": "/api/v1/users/me",
      "timestamp": "2026-06-27T10:30:00Z"
    }

### Pagination

All paginated endpoints accept:

    ?page=0&size=50&sort=createdAt,desc

And return:

    {
      "content": [...],
      "page": 0,
      "size": 50,
      "totalElements": 243,
      "totalPages": 5,
      "last": false
    }

### API Versioning

All endpoints are versioned under /api/v1/.
This follows the stable API versioning introduced in Spring Boot 4.x and is standard production practice — it allows future breaking changes under /api/v2/ without affecting existing clients.

---

## Auth Endpoints

### POST /api/v1/auth/register

Register a new user account.

Auth: None

Request:

    {
      "email": "satyam@example.com",
      "password": "StrongP@ssword1",
      "displayName": "Satyam"
    }

Validation:
- email — valid email format, unique
- password — minimum 8 characters, at least one uppercase, one lowercase, one digit, one special character
- displayName — 2 to 50 characters

Response 201:

    {
      "accessToken": "eyJhbGc...",
      "refreshToken": "550e8400-e29b-41d4-a716...",
      "user": {
        "id": "64f1a2b3c4d5e6f7a8b9c0d1",
        "email": "satyam@example.com",
        "displayName": "Satyam",
        "avatarUrl": null,
        "bio": null,
        "createdAt": "2026-06-27T10:30:00Z"
      }
    }

---

### POST /api/v1/auth/login

Authenticate an existing user.

Auth: None

Request:

    {
      "email": "satyam@example.com",
      "password": "StrongP@ssword1"
    }

Response 200:

    {
      "accessToken": "eyJhbGc...",
      "refreshToken": "550e8400-e29b-41d4-a716...",
      "user": {
        "id": "64f1a2b3c4d5e6f7a8b9c0d1",
        "email": "satyam@example.com",
        "displayName": "Satyam",
        "avatarUrl": "https://pub-xxx.r2.dev/avatars/user-id.jpg",
        "bio": "Career switcher from finance to tech",
        "createdAt": "2026-06-27T10:30:00Z"
      }
    }

---

### POST /api/v1/auth/refresh

Issue a new access token using a valid refresh token.

Auth: None

Request:

    {
      "refreshToken": "550e8400-e29b-41d4-a716..."
    }

Response 200:

    {
      "accessToken": "eyJhbGc...",
      "refreshToken": "550e8400-e29b-41d4-a716..."
    }

Notes:
- Refresh token rotation applied — a new refresh token is issued on every call. The old one is immediately invalidated.
- This is a production security practice that limits the blast radius of a stolen refresh token.

---

### POST /api/v1/auth/logout

Invalidate the current session's tokens.

Auth: Required

Request:

    {
      "refreshToken": "550e8400-e29b-41d4-a716..."
    }

Response: 204

Notes:
- The access token is blacklisted until its natural expiry
- The refresh token is deleted from the database
- Client must discard both tokens on receipt of 204

---

## User Endpoints

### GET /api/v1/users/me

Get the authenticated user's profile.

Auth: Required

Response 200:

    {
      "id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "email": "satyam@example.com",
      "displayName": "Satyam",
      "avatarUrl": "https://pub-xxx.r2.dev/avatars/user-id.jpg",
      "bio": "Career switcher from finance to tech",
      "createdAt": "2026-06-27T10:30:00Z"
    }

---

### PATCH /api/v1/users/me

Update the authenticated user's profile.

Auth: Required

Request (all fields optional — send only what changes):

    {
      "displayName": "Satyam K",
      "bio": "SWE @ Accenture | Angular + Spring Boot"
    }

Response 200: updated user object (same shape as GET /me)

---

### POST /api/v1/users/me/avatar

Upload or replace the authenticated user's avatar.

Auth: Required

Request: multipart/form-data

    file: <image file>

Validation:
- Accepted types: image/jpeg, image/png, image/webp
- Max size: 5MB

Response 200:

    {
      "avatarUrl": "https://pub-xxx.r2.dev/avatars/user-id.jpg"
    }

Notes:
- File uploaded directly to Cloudflare R2
- Old avatar deleted from R2 on replacement
- URL stored on the user document in MongoDB

---

### GET /api/v1/users/search?q={query}

Search for users by display name.

Auth: Required

Query Parameters:
- q — search string, minimum 2 characters

Response 200:

    {
      "content": [
        {
          "id": "64f1a2b3c4d5e6f7a8b9c0d1",
          "displayName": "Satyam",
          "avatarUrl": "https://pub-xxx.r2.dev/avatars/user-id.jpg",
          "bio": "Career switcher from finance to tech",
          "connectionStatus": "NONE"
        }
      ]
    }

Notes:
- connectionStatus is one of: NONE, PENDING_SENT,
  PENDING_RECEIVED, CONNECTED, BLOCKED
- Blocked users do not appear in search results

---

### GET /api/v1/users/{userId}

Get a public profile of another user.

Auth: Required

Response 200:

    {
      "id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "displayName": "Satyam",
      "avatarUrl": "https://pub-xxx.r2.dev/avatars/user-id.jpg",
      "bio": "Career switcher from finance to tech",
      "connectionStatus": "CONNECTED"
    }

Response 200 — when a BLOCKED relationship exists between the requester and target (either direction where the requester is the blocked party):

    {
      "id": "64f1a2b3c4d5e6f7a8b9c0d1",
      "available": false
    }

Notes:
- Returned as a normal 200 with a reduced shape, not a 403/404 — this prevents the requester from being able to distinguish "user doesn't exist" from "user blocked me" from response status alone. See `discussions/007_blocking_behavior.md`.
- Applies only when the requester is the blocked party. The blocking user retains full, normal profile access to the user they blocked.

---

## Contact Endpoints

### GET /api/v1/contacts

Get the authenticated user's contact list.

Auth: Required

Response 200:

    {
      "content": [
        {
          "id": "64f1a2b3c4d5e6f7a8b9c0d2",
          "displayName": "Rahul",
          "avatarUrl": null,
          "bio": "Preparing for FAANG",
          "online": true,
          "conversationId": "64f1a2b3c4d5e6f7a8b9c0d9"
        }
      ]
    }

---

### POST /api/v1/contacts/requests

Send a connection request to another user.

Auth: Required

Request:

    {
      "targetUserId": "64f1a2b3c4d5e6f7a8b9c0d2"
    }

Response 201:

    {
      "id": "64f1a2b3c4d5e6f7a8b9c0d3",
      "status": "PENDING",
      "toUser": {
        "id": "64f1a2b3c4d5e6f7a8b9c0d2",
        "displayName": "Rahul"
      },
      "createdAt": "2026-06-27T10:30:00Z"
    }

Errors:
- 409 — request already exists or users are already connected

---

### GET /api/v1/contacts/requests

Get all pending incoming connection requests.

Auth: Required

Response 200:

    {
      "content": [
        {
          "id": "64f1a2b3c4d5e6f7a8b9c0d3",
          "fromUser": {
            "id": "64f1a2b3c4d5e6f7a8b9c0d4",
            "displayName": "Priya",
            "avatarUrl": null
          },
          "createdAt": "2026-06-27T10:30:00Z"
        }
      ]
    }

---

### PATCH /api/v1/contacts/requests/{requestId}

Accept or decline a connection request.

Auth: Required

Request:

    {
      "action": "ACCEPT"
    }

- action is one of: ACCEPT, DECLINE
- On ACCEPT: contact relationship created, DM conversation
  document created automatically
- On DECLINE: the underlying request record is deleted entirely.
  The requester is not notified, and is free to send a new
  request to the same user at any time. See
  `discussions/008_connection_request_decline_strategy.md`.

Response 200 (ACCEPT):

    {
      "status": "ACCEPTED",
      "conversationId": "64f1a2b3c4d5e6f7a8b9c0d9"
    }

Response 204 (DECLINE): no body — consistent with every other
endpoint in this document where the action deletes/removes state
with nothing new to report back (e.g. `DELETE /api/v1/contacts/{contactId}`,
the mechanically identical unfriend operation this now shares its
delete mechanism with).

---

### DELETE /api/v1/contacts/{contactId}

Remove a contact.

Auth: Required

Response: 204

---

### POST /api/v1/contacts/{contactId}/block

Block a user.

Auth: Required

Response: 204

Notes:
- Blocking removes the existing contact relationship if present
- Blocked user cannot send connection requests or messages
- Blocked user does not appear in search results for the blocker

---

## Conversation Endpoints

### GET /api/v1/conversations

Get all conversations for the authenticated user (DMs and groups), ordered by most recent message.

Auth: Required

Response 200:

    {
      "content": [
        {
          "id": "64f1a2b3c4d5e6f7a8b9c0d9",
          "type": "DIRECT",
          "participant": {
            "id": "64f1a2b3c4d5e6f7a8b9c0d2",
            "displayName": "Rahul",
            "avatarUrl": null,
            "online": true
          },
          "lastMessage": {
            "content": "Have you tried the system design mock?",
            "senderId": "64f1a2b3c4d5e6f7a8b9c0d2",
            "sentAt": "2026-06-27T10:28:00Z"
          },
          "unreadCount": 3,
          "muted": false
        },
        {
          "id": "64f1a2b3c4d5e6f7a8b9c0e1",
          "type": "GROUP",
          "group": {
            "id": "64f1a2b3c4d5e6f7a8b9c0e2",
            "name": "FAANG Interview Prep",
            "avatarUrl": null,
            "memberCount": 24
          },
          "lastMessage": {
            "content": "Check this blind 75 resource",
            "senderDisplayName": "Priya",
            "sentAt": "2026-06-27T10:25:00Z"
          },
          "unreadCount": 0,
          "muted": false
        }
      ]
    }

---

### GET /api/v1/conversations/{conversationId}/messages

Get paginated message history for a conversation.

Auth: Required — must be a participant

Query Parameters:
- page=0&size=50&sort=createdAt,desc
- before={messageId} — cursor-based pagination for loading older messages on scroll (preferred over page-number pagination for chat history)

Response 200:

    {
      "content": [
        {
          "id": "64f1a2b3c4d5e6f7a8b9c0f1",
          "conversationId": "64f1a2b3c4d5e6f7a8b9c0d9",
          "sender": {
            "id": "64f1a2b3c4d5e6f7a8b9c0d2",
            "displayName": "Rahul",
            "avatarUrl": null
          },
          "type": "TEXT",
          "content": "Have you tried the system design mock?",
          "quotedMessage": null,
          "reactions": [],
          "readBy": ["64f1a2b3c4d5e6f7a8b9c0d1"],
          "edited": false,
          "deleted": false,
          "createdAt": "2026-06-27T10:28:00Z",
          "editedAt": null
        }
      ],
      "hasMore": true,
      "nextCursor": "64f1a2b3c4d5e6f7a8b9c0f0"
    }

Notes:
- deleted: true messages return with content: null — the document is preserved for conversation continuity ("This message was deleted" shown on frontend)
- quotedMessage contains a snapshot of the quoted message at time of reply — not a live reference, so deleted quoted messages still show their content in the reply
- This response merges results from `messages` and `blockedMessages`, scoped to `senderId == requester` for the blockedMessages portion. This means a user viewing their own conversation history sees their own blocked-out messages exactly as sent, while the recipient who blocked them never sees these documents at all. See `discussions/007_blocking_behavior.md`.

---

### PATCH /api/v1/conversations/{conversationId}/mute

**(Phase 2)**  
Mute or unmute a conversation.

Auth: Required — must be a participant

Request:

    {
      "muted": true
    }

Response: 204

Notes:
- Muting only suppresses the client-side desktop notification for this conversation. It does not affect the unread count or the live badge push, which continue unconditionally. See [`discussions/010_mute_notification_interaction.md`](./discussions/010_mute_notification_interaction.md)

---

### POST /api/v1/conversations/{conversationId}/messages/{messageId}/read

Mark a message as read.

Auth: Required — must be a participant

Response: 204

Notes:
- Adds the authenticated user's ID to the message's readBy array if not already present
- Triggers a read receipt WebSocket event to the sender

---

## Message Endpoints

### POST /api/v1/conversations/{conversationId}/messages

Send a message via REST.

Auth: Required — must be a participant

Headers:
X-Idempotency-Key: <client-generated UUID>   (optional but recommended on retry)

Note: Real-time messages are sent via WebSocket in normal usage. This REST endpoint exists for reliability — if the WebSocket connection drops, the client falls back to REST. The backend handles both paths identically. If X-Idempotency-Key is provided, duplicate submissions caused by retry logic return the already-persisted message rather than creating a duplicate. The key should be a client-generated UUID, stable for the lifetime of the send attempt.

Request:

    {
      "type": "TEXT",
      "content": "Has anyone tried the Grokking System Design course?",
      "quotedMessageId": null
    }

- type is one of: TEXT, IMAGE, FILE
- quotedMessageId — optional, for quoted replies

Response 201: full message object (same shape as GET messages response)

Notes:
- If the sender is currently blocked by the conversation's other participant, the response is still 201 with an identical-looking message object — the sender receives no indication the message was blocked. Internally, the message is persisted to `blockedMessages` instead of `messages`, and no Kafka publish occurs, so the recipient never receives it. See `discussions/007_blocking_behavior.md`.

---

### PATCH /api/v1/conversations/{conversationId}/messages/{messageId}

Edit a message.

Auth: Required — must be the message sender

Request:

    {
      "content": "Has anyone tried the Grokking System Design course? It's great."
    }

Response 200: updated message object

Notes:
- `MessageService` looks up the message by ID in both `messages` and `blockedMessages`, since a message sent while blocked may live in either collection

---

### DELETE /api/v1/conversations/{conversationId}/messages/{messageId}

Delete a message.

Auth: Required — must be the message sender, or group admin for group messages

Response: 204

Notes:
- Soft delete — deleted: true, content set to null
- Document preserved for conversation continuity
- For IMAGE and FILE type messages, file is also set to null and the underlying object is permanently deleted from Cloudflare R2 — this cannot be undone, unlike the message document itself. See [`discussions/011_message_attachment_cleanup_on_delete.md`](./discussions/011_message_attachment_cleanup_on_delete.md)
- WebSocket event broadcast to all participants (no-op for blockedMessages documents, since there are no other participants with visibility into them)
- `MessageService` looks up the message by ID in both `messages` and `blockedMessages`

---

### POST /api/v1/conversations/{conversationId}/messages/{messageId}/reactions

**(Phase 2)**  
Add or update a reaction on a message.

Auth: Required — must be a participant

Request:

    {
      "emoji": "👍"
    }

Response 200:

    {
      "reactions": [
        { "emoji": "👍", "userId": "64f1a2b3c4d5e6f7a8b9c0d1", "displayName": "Satyam" },
        { "emoji": "🔥", "userId": "64f1a2b3c4d5e6f7a8b9c0d2", "displayName": "Rahul" }
      ]
    }

Notes:
- One reaction per user per message — sending a new emoji replaces the user's existing reaction
- Sending the same emoji the user already has removes it (toggle)

---

### DELETE /api/v1/conversations/{conversationId}/messages/{messageId}/reactions

**(Phase 2)**  
Remove the authenticated user's reaction from a message.

Auth: Required

Response: 204

---

## File Upload Endpoints (Phase 3)

### POST /api/v1/conversations/{conversationId}/messages/upload

Upload a file or image to send as a message.

Auth: Required — must be a participant

Request: multipart/form-data

    file: <file>
    type: IMAGE | FILE

Validation:
- Images: image/jpeg, image/png, image/webp, image/gif — max 10MB
- Files: any type — max 25MB

Response 201: full message object with populated fileUrl and fileName fields

Notes:
- File uploaded to Cloudflare R2 before message document is created
- If R2 upload fails, message is not created — atomic from the client's perspective
- Presigned R2 URLs used for serving files — not public URLs. URL expires after 1 hour. Frontend requests a fresh presigned URL on expiry via GET /api/v1/files/{fileId}/url

---

### GET /api/v1/files/{fileId}/url

Get a fresh presigned URL for a file.

Auth: Required — must be a participant of the conversation the file belongs to

Response 200:

    {
      "url": "https://pub-xxx.r2.dev/files/file-id?X-Amz-Expires=3600...",
      "expiresAt": "2026-06-27T11:30:00Z"
    }

---

## Group Endpoints

### POST /api/v1/groups

Create a new group.

Auth: Required

Request:

    {
      "name": "FAANG Interview Prep",
      "description": "A group for people preparing for top tech company interviews",
      "topicTag": "Interview Prep",
      "visibility": "PUBLIC"
    }

Validation:
- name — 3 to 100 characters, unique
- description — max 500 characters
- topicTag — max 50 characters
- visibility — PUBLIC or PRIVATE

Response 201:

    {
      "id": "64f1a2b3c4d5e6f7a8b9c0e2",
      "name": "FAANG Interview Prep",
      "description": "A group for people preparing...",
      "topicTag": "Interview Prep",
      "visibility": "PUBLIC",
      "avatarUrl": null,
      "memberCount": 1,
      "conversationId": "64f1a2b3c4d5e6f7a8b9c0e1",
      "createdAt": "2026-06-27T10:30:00Z",
      "role": "ADMIN"
    }

---

### GET /api/v1/groups

Discover public groups.

Auth: None for read-only listing and filtering.  
      Required for joining, messaging, or viewing private group details.

Query Parameters:
- q — optional search string (name or description)
- tag — optional filter by topic tag
- page=0&size=20

Response 200: paginated list of group objects

---

### GET /api/v1/groups/{groupId}

Get group details.

Auth: Required — public groups visible to all authenticated users, private groups visible to members only

Response 200:

    {
      "id": "64f1a2b3c4d5e6f7a8b9c0e2",
      "name": "FAANG Interview Prep",
      "description": "A group for people preparing...",
      "topicTag": "Interview Prep",
      "visibility": "PUBLIC",
      "avatarUrl": null,
      "coverImageUrl": null,
      "memberCount": 24,
      "conversationId": "64f1a2b3c4d5e6f7a8b9c0e1",
      "createdAt": "2026-06-27T10:30:00Z",
      "role": "MEMBER"
    }

---

### PATCH /api/v1/groups/{groupId}

Update group details.

Auth: Required — Admin only

Request (all fields optional):

    {
      "name": "FAANG Interview Prep 2026",
      "description": "Updated description",
      "topicTag": "Interview Prep"
    }

Response 200: updated group object

---

### DELETE /api/v1/groups/{groupId}

Delete a group.

Auth: Required — Admin only

Response: 204

Notes:
- Deletes group document, conversation document, and all messages in the conversation
- All members removed from the group
- WebSocket event broadcast to all members before deletion

---

### POST /api/v1/groups/{groupId}/join

Join a public group.

Auth: Required

Response 200:

    {
      "conversationId": "64f1a2b3c4d5e6f7a8b9c0e1",
      "role": "MEMBER"
    }

Errors:
- 403 — group is private (must be invited)
- 409 — already a member

---

### POST /api/v1/groups/{groupId}/leave

Leave a group.

Auth: Required — must be a member

Response: 204

Notes:
- If the leaving user is the only Admin, the longest-standing member is automatically promoted to Admin before removal
- If the leaving user is the only member, the group is deleted

---

### POST /api/v1/groups/{groupId}/invite

Generate a private group invite link.

Auth: Required — Admin only

Response 201:

    {
      "inviteLink": "https://orbit.app/invite/a1b2c3d4e5f6",
      "expiresAt": "2026-07-04T10:30:00Z"
    }

Notes:
- Invite token stored on the group document
- Token expires in 7 days
- Admin can regenerate — previous link is immediately invalidated

---

### POST /api/v1/groups/join-via-invite/{inviteToken}

Join a private group using an invite link.

Auth: Required

Response 200:

    {
      "groupId": "64f1a2b3c4d5e6f7a8b9c0e2",
      "conversationId": "64f1a2b3c4d5e6f7a8b9c0e1",
      "role": "MEMBER"
    }

Errors:
- 404 — token not found or expired
- 409 — already a member

---

### GET /api/v1/groups/{groupId}/members

Get the member list of a group.

Auth: Required — must be a member

Response 200:

    {
      "content": [
        {
          "userId": "64f1a2b3c4d5e6f7a8b9c0d1",
          "displayName": "Satyam",
          "avatarUrl": null,
          "role": "ADMIN",
          "online": true,
          "joinedAt": "2026-06-27T10:30:00Z"
        }
      ]
    }

---

### DELETE /api/v1/groups/{groupId}/members/{userId}

Remove a member from a group.

Auth: Required — Admin only, cannot remove another Admin

Response: 204

---

### PATCH /api/v1/groups/{groupId}/members/{userId}/role

Promote or demote a group member.

Auth: Required — Admin only

Request:

    {
      "role": "ADMIN"
    }

- role is one of: ADMIN, MEMBER

Response: 200

---

### POST /api/v1/groups/{groupId}/avatar

**(Phase 2)**  
Upload or replace group avatar.

Auth: Required — Admin only

Request: multipart/form-data

    file: <image file>

Response 200:

    {
      "avatarUrl": "https://pub-xxx.r2.dev/groups/group-id-avatar.jpg"
    }

---

### POST /api/v1/groups/{groupId}/cover

**(Phase 2)**  
Upload or replace group cover image.

Auth: Required — Admin only

Request: multipart/form-data

    file: <image file>

Response 200:

    {
      "coverImageUrl": "https://pub-xxx.r2.dev/groups/group-id-cover.jpg"
    }

---

### POST /api/v1/groups/{groupId}/messages/{messageId}/pin

**(Phase 2)**  
Pin a message in a group.

Auth: Required — Admin only

Response: 204

Response 409: group already has 10 pinned messages — unpin one before pinning another. No auto-eviction of the oldest pin. See [`discussions/009_pin_limit_overflow.md`](./discussions/009_pin_limit_overflow.md)

---

### DELETE /api/v1/groups/{groupId}/messages/{messageId}/pin

**(Phase 2)**  
Unpin a message in a group.

Auth: Required — Admin only

Response: 204

---

## Search Endpoints (Phase 3)

### GET /api/v1/search/messages?q={query}&conversationId={id}

Search messages within a specific conversation.

Auth: Required — must be a participant of the conversation

Query Parameters:
- q — search string, minimum 2 characters
- conversationId — required

Response 200:

    {
      "content": [
        {
          "id": "64f1a2b3c4d5e6f7a8b9c0f1",
          "content": "Has anyone tried the Grokking System Design course?",
          "sender": {
            "displayName": "Satyam"
          },
          "createdAt": "2026-06-27T10:28:00Z"
        }
      ]
    }

Notes:
- Same merge behavior as `GET .../conversations/{conversationId}/messages` — results are drawn from both `messages` and `blockedMessages` (scoped to `senderId == requester` for the latter), using the compound text index defined on each collection. See `discussions/007_blocking_behavior.md`.

---

## AI Endpoints (Phase 4)

All AI endpoints are gated behind Phase 4 and will not exist in the backend until Phase 4 begins.

### POST /api/v1/ai/summary

Generate a summary of recent messages in a conversation.

Auth: Required — must be a participant

Request:

    {
      "conversationId": "64f1a2b3c4d5e6f7a8b9c0e1",
      "messageLimit": 100
    }

Response 200:

    {
      "summary": "The group discussed Blind 75 resources and system design
      preparation. Rahul shared a Grokking course link. Priya asked about
      mock interview platforms. General consensus was to use LeetCode for
      DSA and Grokking for system design."
    }

Notes:
- Summary is also broadcast as a bot message in the conversation via WebSocket so all participants see it

---

### POST /api/v1/ai/ask

Ask the AI assistant a question in the context of a conversation.

Auth: Required — must be a participant

Request:

    {
      "conversationId": "64f1a2b3c4d5e6f7a8b9c0e1",
      "question": "What is the difference between WebSockets and SSE?"
    }

Response 200:

    {
      "answer": "WebSockets provide full-duplex communication..."
    }

Notes:
- Answer also broadcast as a bot message via WebSocket

---

### POST /api/v1/ai/suggest-replies

Get smart reply suggestions for an incoming message.

Auth: Required

Request:

    {
      "conversationId": "64f1a2b3c4d5e6f7a8b9c0e1",
      "messageId": "64f1a2b3c4d5e6f7a8b9c0f1"
    }

Response 200:

    {
      "suggestions": [
        "Sounds good, I'll check it out!",
        "Can you share the link?",
        "I tried it last week, it's really helpful."
      ]
    }

---

### POST /api/v1/ai/translate

Translate a message to English.

Auth: Required

Request:

    {
      "messageId": "64f1a2b3c4d5e6f7a8b9c0f1",
      "targetLanguage": "English"
    }

Response 200:

    {
      "originalContent": "Bonjour, comment ça va?",
      "translatedContent": "Hello, how are you?",
      "detectedLanguage": "French"
    }

---

### POST /api/v1/ai/tone-check

Check the tone of a message before sending.

Auth: Required

Request:

    {
      "content": "Why haven't you done this yet? It's been three days."
    }

Response 200:

    {
      "flagged": true,
      "reason": "Message may read as accusatory or impatient",
      "suggestion": "Could you give me an update on this? It's been a few
      days and I want to make sure we're on track."
    }

---

## WebSocket Contracts

### Connection

Endpoint: ws://localhost:8080/ws

Handshake: SockJS negotiates the connection. JWT access token passed as a query parameter on connect:

    ws://localhost:8080/ws?token=eyJhbGc...

Notes:
- Token validated on connection. Invalid or expired token results in connection refused with close code 4401
- Token is not re-validated on every message — only on initial connection. Client is responsible for reconnecting with a fresh token when the access token expires.
- On reconnect, the client resubscribes to all previous destinations automatically.

---

### STOMP Destinations

#### Client to Server (send)

Send a message:

    Destination: /app/conversations/{conversationId}/send
    Body:
    {
      "type": "TEXT",
      "content": "Hello everyone!",
      "quotedMessageId": null
    }

Typing indicator:

    Destination: /app/conversations/{conversationId}/typing
    Body:
    {
      "typing": true
    }

Mark as read:

    Destination: /app/conversations/{conversationId}/read
    Body:
    {
      "messageId": "64f1a2b3c4d5e6f7a8b9c0f1"
    }

---

#### Server to Client (subscribe)

New message in a conversation:

    Destination: /topic/conversations/{conversationId}/messages
    Payload:
    {
      "id": "64f1a2b3c4d5e6f7a8b9c0f1",
      "sender": { "id": "...", "displayName": "Satyam" },
      "type": "TEXT",
      "content": "Hello everyone!",
      "reactions": [],
      "readBy": [],
      "edited": false,
      "deleted": false,
      "createdAt": "2026-06-27T10:30:00Z"
    }

Typing indicator:

    Destination: /topic/conversations/{conversationId}/typing
    Payload:
    {
      "userId": "64f1a2b3c4d5e6f7a8b9c0d2",
      "displayName": "Rahul",
      "typing": true
    }

Reaction update:

    Destination: /topic/conversations/{conversationId}/reactions
    Payload:
    {
      "messageId": "64f1a2b3c4d5e6f7a8b9c0f1",
      "reactions": [
        { "emoji": "👍", "userId": "...", "displayName": "Rahul" }
      ]
    }

Message edited:

    Destination: /topic/conversations/{conversationId}/messages/edited
    Payload:
    {
      "messageId": "64f1a2b3c4d5e6f7a8b9c0f1",
      "content": "Updated message content",
      "editedAt": "2026-06-27T10:35:00Z"
    }

Message deleted:

    Destination: /topic/conversations/{conversationId}/messages/deleted
    Payload:
    {
      "messageId": "64f1a2b3c4d5e6f7a8b9c0f1"
    }

Read receipt:

    Destination: /topic/conversations/{conversationId}/read
    Payload:
    {
      "messageId": "64f1a2b3c4d5e6f7a8b9c0f1",
      "userId": "64f1a2b3c4d5e6f7a8b9c0d2",
      "readAt": "2026-06-27T10:31:00Z"
    }

Presence update (user online/offline):

    Destination: /topic/presence/{userId}
    Payload:
    {
      "userId": "64f1a2b3c4d5e6f7a8b9c0d2",
      "online": false,
      "lastSeen": "2026-06-27T10:30:00Z"
    }

Personal notification (unread count, mention):

    Destination: /user/queue/notifications
    Payload:
    {
      "type": "UNREAD_COUNT",
      "conversationId": "64f1a2b3c4d5e6f7a8b9c0e1",
      "count": 5
    }

Notes:
- /topic/... destinations are shared — all subscribers in a conversation receive the event
- /user/queue/... destinations are private — only the authenticated user receives the event
- Spring's convertAndSendToUser handles private delivery internally via the STOMP user destination prefix

---

## Rate Limiting

Applied at the application layer using a token bucket strategy per authenticated user:

| Endpoint Group                    | Limit                  |
|-----------------------------------|------------------------|
| Auth endpoints                    | 10 requests / minute   |
| Message send (REST + WebSocket)   | 60 messages / minute   |
| File upload                       | 10 uploads / minute    |
| AI endpoints                      | 20 requests / minute   |
| All other endpoints               | 100 requests / minute  |

Exceeding a limit returns 429 Too Many Requests with a Retry-After header indicating seconds until the limit resets.
