# Features

Orbit is a real-time chat application for people who connect over shared goals — career switchers, interview preppers, learners, and builders.

Features are organised across four phases, each building on the previous.  
Phase 1 must be fully working and deployed before Phase 2 begins.

---

## Phase 1 — Core

The minimum viable product. Everything in this phase must be complete and demo-ready before any Phase 2 work begins.

### Authentication
- User registration with email and password
- User login with email and password
- JWT-based authentication
    - Access token: 15 minutes expiry
    - Refresh token: 7 days expiry
- Protected routes on the frontend
- Logout with token invalidation

### User Profile
- Display name
- Bio (short text — "Career switcher from finance to tech")
- Profile visible to other users in the app

### Contacts
- Send a connection request to another user
- Accept or decline an incoming connection request
- View contact list
- Block a user

### Direct Messages (1:1)
- Real-time message delivery via WebSocket
- Message history on conversation open (last 50 messages,
  paginated on scroll)
- Edit your own message
- Delete your own message
- Typing indicator ("Satyam is typing...")
- Read receipts (delivered / seen)
- Online / offline presence indicator per contact

### Groups
- Create a group with a name, description, and topic tag
- Public groups — discoverable and joinable by any user
- Private groups — invite only
- Group member list with roles (Admin, Member)
- Leave a group
- Admin can remove a member
- Admin can delete the group

### Group Messaging
- Real-time message delivery via WebSocket (same as DMs)
- Message history on open (last 50 messages, paginated on scroll)
- Edit your own message
- Delete your own message
- Typing indicator ("3 people are typing...")
- Online / offline presence per group member

### Group Discovery
- Browse public groups
- Filter groups by topic tag
- Join a public group directly from discovery

---

## Phase 2 — Enhancement

Builds on the working core to add interactions and quality of life features that make the app feel complete.

### Message Interactions
- Emoji reactions on any message
- Quoted reply — reply to a specific message with the original shown inline above your reply
- Unread message count badge per conversation in the sidebar

### Notifications
- Browser desktop notifications for new messages when the tab is not in focus (Web Notifications API — no backend required)

### User Profile Updates
- Upload and update profile avatar (Cloudflare R2)
- Update display name and bio

### Group Management Updates
- Upload group avatar and cover image (Cloudflare R2)
- Pin an important message in a group
- Mute a conversation (DM or group)

---

## Phase 3 — Search & Files

Adds discoverability and richer content sharing.

### Search
- Search users by display name
- Search public groups by name or topic tag
- Search messages within a conversation

### File & Image Sharing
- Send images inline in a message
- Inline image preview in the conversation
- Send non-image files as attachments
- Download link for file attachments
- Files and images stored in Cloudflare R2

---

## Phase 4 — AI Features

AI features are intentionally deferred to Phase 4.  
They are only built on top of a fully working, deployed application.

All AI features use the Claude API (Anthropic).  
Server-side processing of message content is required for all features in this phase. End-to-end encryption is therefore not implemented — this tradeoff is documented in[`discussions/004_e2ee_vs_ai_features.md`](./discussions/004_e2ee_vs_ai_features.md).

### AI Summary Bot (`/summary`)
- Type `/summary` in any group or DM conversation
- Returns a concise summary of recent messages as a bot message visible to all participants
- Useful for catching up after being offline

### AI Assistant Bot (`@ask`)
- Mention `@ask` followed by any question in a group
- Bot responds inline, visible to all group members
- Collaborative knowledge — everyone sees the answer
- Example: `@ask what is the difference between WebSockets and SSE?`

### Smart Reply Suggestions
- After receiving a message, 2-3 contextual quick reply suggestions appear below the input field
- One click to send the suggestion as-is or edit before sending
- Suggestions are generated from conversation context, not generic templates

### Message Translation
- Per-message option: "Translate to English"
- Translated text appears inline below the original message
- Original message remains visible
- Useful for multilingual groups

### Tone Checker
- Optional toggle in message input settings
- When enabled, analyses your message before sending
- Flags if the message reads as aggressive, unclear, or likely to be misread
- Suggests a softer or clearer alternative
- User can proceed with original or use the suggestion

---

## Deliberately Out of Scope

These features were explicitly considered and excluded.
They will not be added in any phase.

| Feature | Reason |
|---|---|
| Video / audio calls | WebRTC is a separate domain entirely |
| Mobile application | React Native is a separate project |
| End-to-end encryption | Incompatible with Phase 4 AI features — see ADR 004 |
| Bot / webhook integrations | Scope creep, no clear use case |
| AI content moderation | Overkill for portfolio scale |
| Workspace / channel model | Replaced by people-first group model |

---

## Phase Summary

| Phase | Focus | Status |
|---|---|---|
| Phase 1 | Auth, contacts, DMs, groups, presence, discovery | 🔲 In Progress |
| Phase 2 | Reactions, replies, notifications, avatars, pins | 🔲 Planned |
| Phase 3 | Search, file and image uploads | 🔲 Planned |
| Phase 4 | AI summary, @ask, smart replies, translation, tone check | 🔲 Planned |