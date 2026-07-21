# Frontend Project Structure

This document defines the folder layout, component organisation, naming conventions, and state management patterns for the Orbit React SPA. It is the implementation-level reference for building the frontend across all four phases.

React has no enforced structure — this document provides the deliberate decisions that prevent structural drift as the project grows across phases.

---

## Technology Stack Reference

- **React 19** — UI library
- **Vite** — build tool and dev server
- **React Router** — client-side routing
- **Axios** — HTTP client with interceptors
- **SockJS + STOMP.js** — WebSocket client
- **useState / useReducer / useContext** — state management (no external library)

---

## Top-Level Project Layout

```
frontend/
├── src/
│   ├── main.jsx                    ← app entry point, React root mount
│   ├── App.jsx                     ← router setup, global providers
│   ├── pages/                      ← route-level components (one per page)
│   ├── components/                 ← reusable UI components
│   ├── hooks/                      ← custom React hooks
│   ├── services/                   ← API calls and WebSocket management
│   ├── context/                    ← React context providers and consumers
│   ├── utils/                      ← pure helper functions
│   └── assets/                     ← static files (icons, images)
├── public/                         ← files served as-is (favicon, robots.txt)
├── .env.example
├── .gitignore
├── index.html
├── package.json
├── vite.config.js
└── vercel.json                     ← auto-deploy disabled: { "git": { "deploymentEnabled": false } }
```

---

## Folder Responsibilities

### pages/

Route-level components. Each file maps to one URL. Pages are responsible for layout and data orchestration — they compose smaller components but contain minimal UI themselves. Pages are the only components that directly consume context.

```
src/pages/
├── AuthPage.jsx                    ← /login and /register (tabbed)
├── DiscoverPage.jsx                ← /discover — public group discovery (guest + user)
├── ConversationsPage.jsx           ← / — sidebar + active conversation view
├── GroupPage.jsx                   ← /groups/:groupId — group detail and join
└── NotFoundPage.jsx                ← 404 fallback
```

### components/

Reusable UI components organised by feature area. Components are "dumb" by default — they receive data via props and emit events via callbacks. They do not call APIs or access context directly (except for global UI concerns like theme).

```
src/components/
├── auth/
│   ├── LoginForm.jsx
│   └── RegisterForm.jsx
│
├── layout/
│   ├── AppShell.jsx                ← outer shell: sidebar + main area
│   ├── Sidebar.jsx                 ← conversation list + navigation
│   └── ProtectedRoute.jsx          ← redirects unauthenticated users to /login
│
├── conversation/
│   ├── ConversationList.jsx        ← scrollable list of DMs and groups
│   ├── ConversationItem.jsx        ← single row: avatar, name, last message, unread badge
│   └── ConversationSearch.jsx      ← filter conversations by name
│
├── message/
│   ├── MessageThread.jsx           ← scrollable message history for active conversation
│   ├── MessageBubble.jsx           ← single message: content, sender, timestamp, status
│   ├── MessageInput.jsx            ← text input, send button, file attach, emoji
│   ├── MessageReactions.jsx        ← emoji reaction row below a message
│   ├── QuotedMessage.jsx           ← inline quoted reply preview
│   ├── FileMessage.jsx             ← image preview or file download card
│   ├── BotMessage.jsx              ← "Orbit AI" message variant (Phase 4)
│   └── TypingIndicator.jsx         ← "Satyam is typing…" display
│
├── presence/
│   ├── OnlineDot.jsx               ← green/grey presence dot
│   └── LastSeen.jsx                ← "last seen 10 mins ago" text
│
├── group/
│   ├── GroupHeader.jsx             ← group name, member count, actions
│   ├── GroupMemberList.jsx         ← scrollable member list with roles
│   ├── GroupDiscoverCard.jsx       ← card shown in discovery feed
│   └── GroupDiscoverFeed.jsx       ← grid of GroupDiscoverCards
│
├── contact/
│   ├── ContactList.jsx             ← contacts sidebar panel
│   ├── ContactItem.jsx             ← single contact row with presence dot
│   └── ContactRequestBadge.jsx     ← pending request count indicator
│
├── profile/
│   ├── UserAvatar.jsx              ← avatar image with fallback initials
│   ├── ProfileCard.jsx             ← mini profile popup on name click
│   └── EditProfileForm.jsx         ← display name + bio edit form
│
├── search/
│   ├── GlobalSearch.jsx            ← search users, groups, messages
│   └── SearchResult.jsx            ← single result row
│
├── ai/                             ← Phase 4 only
│   ├── SmartReplySuggestions.jsx   ← 3-chip suggestion bar above input
│   ├── ToneCheckAlert.jsx          ← pre-send warning banner
│   └── AiCommandDetector.jsx       ← detects /summary and @ask in input
│
└── ui/                             ← generic, domain-agnostic UI primitives
    ├── Button.jsx
    ├── Input.jsx
    ├── Modal.jsx
    ├── Spinner.jsx
    ├── Toast.jsx
    ├── Avatar.jsx
    └── Badge.jsx
```

### hooks/

Custom React hooks. This is where all stateful logic that is not tied to a specific component lives. The rule: if logic is reused across two or more components, or if it involves side effects (API calls, WebSocket subscriptions, timers), it belongs in a hook.

```
src/hooks/
├── useAuth.js                      ← reads auth state from AuthContext
├── useWebSocket.js                 ← manages SockJS connection lifecycle,
│                                      returns { connected, subscribe, send, disconnect }
├── useConversation.js              ← loads messages, handles real-time updates
│                                      for the active conversation
├── usePresence.js                  ← subscribes to /topic/presence/{contactId}
│                                      per contact, returns online status map
├── useTypingIndicator.js           ← sends typing events, debounces stop event,
│                                      receives typing events from other users
├── useNotifications.js             ← subscribes to /user/queue/notifications,
│                                      manages unread counts, fires browser desktop
│                                      notifications (skipped if the conversation's
│                                      muted flag is true — see ADR 010)
├── useInfiniteMessages.js          ← cursor-based pagination for message history
│                                      (loads older messages on scroll to top)
├── useFileUpload.js                ← handles file selection, validation, upload
│                                      to REST endpoint, progress state
└── useAi.js                        ← calls AI endpoints, manages suggestion state
                                       (Phase 4 only)
```

### services/

Modules that communicate with the backend. No React in here — pure JavaScript modules that return Promises or manage connections. Components and hooks import from services, never import Axios or SockJS directly.

```
src/services/
├── api.js                          ← Axios instance with base URL, JWT interceptor,
│                                      refresh-and-retry on 401
├── authService.js                  ← register, login, logout, refresh
├── userService.js                  ← getMe, updateProfile, uploadAvatar, searchUsers
├── contactService.js               ← getContacts, sendRequest, respond, block
├── groupService.js                 ← createGroup, joinGroup, leaveGroup, getMembers,
│                                      generateInvite, joinViaInvite
├── conversationService.js          ← getConversations, getMessages, markRead, mute
├── messageService.js               ← send (REST fallback), editMessage, deleteMessage,
│                                      addReaction, removeReaction, uploadFile
├── searchService.js                ← searchUsers, searchGroups, searchMessages
├── websocketService.js             ← SockJS + STOMP connection management,
│                                      singleton — one connection for the app lifetime
└── aiService.js                    ← summary, ask, suggestReplies, translate,
                                       toneCheck  (Phase 4 only)
```

**`api.js` is the most important file in `services/`.** It configures:
- `baseURL` from `import.meta.env.VITE_API_BASE_URL`
- Request interceptor: attaches `Authorization: Bearer {accessToken}` from memory
- Response interceptor: on 401, calls `authService.refresh()`, retries original request once, redirects to login if refresh fails

**`websocketService.js` is a singleton module** — not a class, not a hook, a module-level singleton. It manages one SockJS connection for the entire app lifetime. Hooks call `websocketService.subscribe()` and `websocketService.send()` — they never create their own connections.

### context/

React context providers for global state that needs to be accessible deep in the component tree without prop drilling.

```
src/context/
├── AuthContext.jsx                 ← current user, accessToken (in memory),
│                                      login/logout functions
├── ConversationContext.jsx         ← active conversation, messages, real-time updates
├── NotificationContext.jsx         ← unread counts per conversationId
└── ToastContext.jsx                ← global toast notifications (success, error, info)
```

**Context is not a state management replacement.** It is used only for state that is genuinely global — auth, notifications, toasts. Conversation state is in `ConversationContext` because it is read by multiple siblings (sidebar unread counts + message thread + input). Local state stays in components or hooks.

### utils/

Pure functions with no side effects and no React imports.

```
src/utils/
├── dateUtils.js                    ← formatTimestamp, formatLastSeen,
│                                      isToday, isYesterday
├── messageUtils.js                 ← deriveMessageStatus (SENDING/SENT/DELIVERED/READ),
│                                      isEdited, isDeleted, groupMessagesByDate
├── fileUtils.js                    ← getFileIcon, formatFileSize, isImageType
├── tokenUtils.js                   ← parseJwtExpiry, isTokenExpired
└── constants.js                    ← TYPING_DEBOUNCE_MS = 3000,
                                       TYPING_SEND_INTERVAL_MS = 2000,
                                       TYPING_AUTO_CLEAR_MS = 5000,
                                       MESSAGE_PAGE_SIZE = 50,
                                       MAX_FILE_SIZE_IMAGE = 10485760,
                                       MAX_FILE_SIZE_FILE = 26214400
```

Constants that are referenced in multiple places — typing debounce timings, file size limits, pagination sizes — live in `constants.js`. No magic numbers scattered across the codebase.

---

## Routing Structure

```jsx
// App.jsx
<BrowserRouter>
  <AuthProvider>
    <NotificationProvider>
      <ToastProvider>
        <Routes>
          <Route path="/login"    element={<AuthPage />} />
          <Route path="/discover" element={<DiscoverPage />} />  {/* guest + user */}
          <Route element={<ProtectedRoute />}>
            <Route path="/"           element={<ConversationsPage />} />
            <Route path="/groups/:id" element={<GroupPage />} />
          </Route>
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </ToastProvider>
    </NotificationProvider>
  </AuthProvider>
</BrowserRouter>
```

`ProtectedRoute` checks `AuthContext` — if no authenticated user, redirects to `/login` with the attempted path stored in location state for redirect-after-login.

`/discover` is accessible without authentication (guest group browsing) but renders differently based on auth state — guests see a "Register to join" CTA, authenticated users see a "Join" button.

---

## State Management Strategy

Orbit uses React's built-in state primitives only — no Redux, no Zustand, no MobX. The decision is deliberate: the app state is not complex enough to justify an external library, and keeping state local prevents over-engineering for a portfolio project.

### State placement rules

| State type | Where it lives |
|---|---|
| Auth (user, token) | `AuthContext` |
| Active conversation messages | `ConversationContext` |
| Unread counts | `NotificationContext` |
| Form input values | `useState` in the form component |
| Loading / error per request | `useState` in the calling hook |
| Typing indicator state | `useTypingIndicator` hook |
| Presence (online map) | `usePresence` hook |
| Optimistic messages | `ConversationContext` |

### Optimistic updates

Message sends use optimistic UI — the message is appended to `ConversationContext` immediately with a temporary ID and `status: SENDING`. On server receipt, the temporary entry is replaced with the confirmed message using the server-assigned `_id`. On error, the temporary entry is marked `status: FAILED` with a retry option.

This pattern is implemented entirely in `ConversationContext` and `useConversation` — `MessageInput` just calls `send()` and the context handles the rest.

---

## WebSocket Integration Pattern

The WebSocket connection is managed as a singleton in `websocketService.js`. Hooks subscribe to specific STOMP destinations and receive events via callbacks.

```
websocketService.js (singleton)
    └── connect(token)
    └── subscribe(destination, callback) → returns unsubscribe fn
    └── send(destination, body)
    └── disconnect()

useWebSocket.js
    ├── calls websocketService.connect on mount
    ├── calls websocketService.disconnect on unmount
    └── exposes { connected, subscribe, send }

useConversation.js
    ├── calls subscribe('/topic/conversations/{id}/messages', onMessage)
    ├── calls subscribe('/topic/conversations/{id}/typing', onTyping)
    ├── calls subscribe('/topic/conversations/{id}/reactions', onReaction)
    └── returns messages, typingUsers, sendMessage, editMessage, deleteMessage

usePresence.js
    ├── calls subscribe('/topic/presence/{contactId}', onPresence) per contact
    └── returns onlineStatusMap: { [userId]: boolean }

useNotifications.js
    ├── calls subscribe('/user/queue/notifications', onNotification)
    ├── updates NotificationContext unread counts (unconditional, ignores mute)
    └── fires browser desktop notification if tab unfocused, unless conversation is muted
```

**Rules:**
- Components never call `websocketService` directly — they go through hooks
- Every `subscribe()` call returns an unsubscribe function — hooks call it in the `useEffect` cleanup to prevent memory leaks and duplicate subscriptions on re-render
- Subscriptions are re-established in `useEffect` whenever the active conversation changes

---

## JWT Token Storage

Access tokens are stored **in memory only** — in `AuthContext` state, not in `localStorage` or `sessionStorage`. This prevents XSS-based token theft.

```
AuthContext state:
  currentUser: { id, email, displayName, avatarUrl }
  accessToken: string (in memory)

Refresh token: httpOnly cookie (set by server, inaccessible to JavaScript)
```

`api.js` interceptor reads `accessToken` from `AuthContext` for every request. On 401, it calls `authService.refresh()` (the refresh token is sent automatically via the httpOnly cookie), stores the new access token in `AuthContext`, and retries the original request.

On page refresh, the access token in memory is lost. The app calls `authService.refresh()` on mount — if the httpOnly cookie is still valid, a new access token is issued transparently and the user stays logged in.

---

## Naming Conventions

| Type | Convention | Example |
|---|---|---|
| Page component | PascalCase + `Page` suffix | `ConversationsPage.jsx` |
| Feature component | PascalCase, descriptive | `MessageBubble.jsx` |
| UI primitive | PascalCase, generic | `Button.jsx`, `Modal.jsx` |
| Custom hook | camelCase + `use` prefix | `useConversation.js` |
| Service module | camelCase + `Service` suffix | `messageService.js` |
| Context file | PascalCase + `Context` suffix | `AuthContext.jsx` |
| Util file | camelCase + `Utils` or `Utils` suffix | `dateUtils.js` |
| Constants file | `constants.js` | — |
| Env variable | `VITE_` prefix | `VITE_API_BASE_URL` |
| Constant value | SCREAMING_SNAKE_CASE | `TYPING_DEBOUNCE_MS` |

---

## Phase-by-Phase Build Order

This sequence avoids building UI before the backend it depends on is ready.

### Phase 1
```
services/api.js                     ← first — everything depends on this
services/websocketService.js        ← second — WebSocket singleton
context/AuthContext.jsx
pages/AuthPage.jsx + components/auth/
hooks/useWebSocket.js
context/ConversationContext.jsx
hooks/useConversation.js
components/layout/AppShell + Sidebar
components/conversation/
components/message/MessageThread + MessageBubble + MessageInput
hooks/usePresence.js + useTypingIndicator.js
components/presence/
pages/DiscoverPage.jsx + components/group/GroupDiscoverFeed
```

### Phase 2
```
components/message/MessageReactions + QuotedMessage + FileMessage
hooks/useNotifications.js
context/NotificationContext.jsx
components/contact/ContactRequestBadge
hooks/useFileUpload.js
components/profile/EditProfileForm
```

### Phase 3
```
components/search/
services/searchService.js
hooks/useInfiniteMessages.js        ← replaces basic pagination
messageService.js uploadFile
```

### Phase 4
```
services/aiService.js
hooks/useAi.js
components/ai/
components/message/BotMessage
```

---

## Environment Variables

```
VITE_API_BASE_URL=http://localhost:8080
VITE_WS_URL=ws://localhost:8080/ws
```

All environment variables must be prefixed with `VITE_` to be exposed at build time by Vite. Access them in code via `import.meta.env.VITE_API_BASE_URL` — never via `process.env`.
