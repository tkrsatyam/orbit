# Orbit UI Design System & Screen Blueprint

This document defines the visual identity, token architecture, and screen matrix for Orbit. It enforces modern vector iconography, text-wrapping constraints, rich group community avatars, and a strict 1:1 parallel relationship between Desktop (`1440 × 900`) and Mobile Browser (`390 × 844`) views.

The active design implementation is hosted on Penpot and accessible via the Penpot MCP.

---

## 1. Orbit Visual Identity & Theme (Carbon Graphite & Warm Amber)

Orbit's visual identity is **Carbon Graphite & Warm Amber**. It combines a dark carbon base with radiant honey amber accents, providing high readability, reduced eye strain, and an approachable community feel for learners and builders.

### Official Design Tokens

| Token Variable | Dark Mode (`[data-theme="dark"]`) | Light Mode (`[data-theme="light"]`) | Functional Purpose |
| :--- | :--- | :--- | :--- |
| `--orbit-bg` | `#121214` (Carbon Black) | `#FAF9F6` (Alabaster White) | Main viewport base canvas |
| `--orbit-surface` | `#18181B` (Warm Charcoal) | `#FFFFFF` (Pure White) | Sidebar, navigation rail, and cards |
| `--orbit-elevated` | `#27272A` | `#F4F3EF` | Dropdowns, popovers, and elevated modals |
| `--orbit-border` | `#2E2E33` | `#E4E2DC` | 1px structural borders and dividers |
| `--orbit-accent` | `#F59E0B` (Amber 500) | `#D97706` (Honey Amber 600) | Primary CTA, active selections, badges |
| `--orbit-accent-subtle` | `rgba(245, 158, 11, 0.12)` | `rgba(217, 119, 6, 0.10)` | Active channel background, chips |
| `--orbit-text-primary` | `#EDEDEF` | `#1C1917` (Warm Stone) | High-contrast message text and headings |
| `--orbit-text-muted` | `#A1A1AA` | `#78716C` | Timestamps, secondary subtitles, read receipts |
| `--orbit-presence-online`| `#22C55E` (Emerald Green) | `#16A34A` | Real-time presence indicator dot |
| `--orbit-danger` | `#F43F5E` (Rose) | `#E11D48` | Destructive actions (Block user, Leave group) |

---

## 2. Brand Vector Assets & Iconography Standards

### Official Brand Assets (`docs/brand/` & `frontend/public/brand/`)

Orbit's custom brand identity replaces all placeholder geometric shapes and text glyphs:

| Asset | File Name | Dimensions / ViewBox | Primary Placement in Penpot |
| :--- | :--- | :--- | :--- |
| **Kinetic Orbit Mark** | `orbit-icon.svg` | `100 × 100` | Desktop navigation rail squircle (`26 × 26` centered at `x: board.x + 21, y: 825`), Component Library showcase |
| **Kinetic Light Mark** | `orbit-icon-light.svg` | `100 × 100` | Light mode navigation rail & brand header |
| **Horizontal Logo Lockup** | `orbit-logo-horizontal.svg` | `240 × 60` | Mobile Conversation List header (`104 × 26` at `x: 488, y: 1819`), Marketing & Documentation headers |
| **Squircle App Icon** | `orbit-app-icon.svg` | `192 × 192` (`rx: 42`) | Desktop Authentication Hero Panel (`64 × 64` at `x: 6100, y: 916`), Mobile Authentication Card (`52 × 52` at `x: 6209, y: 1900`), PWA app icon |

### Kinetic Orbit Mark Anatomy
- **Dual-Arc Orbital Sweep**: Warm amber lower arc (`#D97706` → `#F59E0B` → `#FCD34D`) and crisp slate/white upper arc (`#FFFFFF` → `#EDEDEF` → `#94A3B8`) sweeping counter-clockwise with rounded terminals (`stroke-width: 7`).
- **Gravitational Orbit Track**: Subtle concentric dashed guide (`stroke: #F59E0B`, `stroke-width: 1.5`, `stroke-dasharray: 3 4`, `opacity: 0.45`).
- **Core Glow**: Radial core emitter (`#FEF08A` → `#F59E0B` → `#B45309`) anchored at `(50, 50)`.
- **Satellites & Beacons**: Trailing entrance node (`r: 3.2`, `#EDEDEF`) at `(26.9, 25.2)` and active beacon with ambient amber corona at `(73.1, 74.8)`.

### Production UI Standards
1. **Monochrome Vector SVGs Only**: No raw OS emoji glyphs are used for UI actions or indicators. All buttons, badges, and navigational items use clean stroke-based SVG paths (Lucide / Custom SVGs).
2. **Read Receipts**: Read receipts use Telegram/WhatsApp-style overlapping double-check vectors (`stroke-width: 1.8`, `#F59E0B`), not separate text unicode characters.
3. **Send Button**: Clean button featuring text "Send" and a modern directional paper-plane vector icon.
4. **Group Photos & Visual Badges**:
   * Groups support uploaded community photos via Cloudflare R2 (`avatarUrl` in `Group` model).
   * Default community avatars feature distinct domain-specific vector badges (Coffee cup for Java & Spring, Code brackets `< >` for DSA, Layers for Full Stack, Shield for Angular, Compass for Career Switchers, Cloud for DevOps), replacing plain `#` symbols.
   * Topic tags (e.g. `#java-spring`, `#interview-prep`) are rendered as subtle metadata pills.
5. **Left Rail Navigation**: Restricted strictly to 4 core tabs (`Chats`, `Groups`, `Contacts`, `Discover`), with bottom utilities for Theme Toggle (`Sun/Moon`), Settings (`Gear`), and Profile avatar.
6. **Text Auto-Wrapping**: Every multiline text container has constrained width and `growType: "auto-height"` to ensure natural multi-line wrapping without horizontal overflow.

---

## 3. Penpot Design Canvas Structure (20 Production Boards Live)

Every screen in Orbit is designed with a 1:1 parallel relationship between Desktop (`1440 × 900`) and Mobile Browser (`390 × 844`).

```
[Row 1: Desktop Views, y: 800]
x: 40           x: 1540         x: 3040         x: 4540         x: 6040         x: 7540         x: 9040         x: 10540
+-------------+ +-------------+ +-------------+ +-------------+ +-------------+ +-------------+ +-------------+ +-------------+
| Desktop DM  | | Desktop Grp | | Desktop Disc| | Desktop Set | | Desktop Auth| | Desktop My  | | Desktop New | | Desktop New |
|             | |             | |             | | (Settings)  | |             | | Profile Mdl | | Group Modal | | Chat Modal  |
| (1440×900)  | | (1440×900)  | | (1440×900)  | | (1440×900)  | | (1440×900)  | | (1440×900)  | | (1440×900)  | | (1440×900)  |
+-------------+ +-------------+ +-------------+ +-------------+ +-------------+ +-------------+ +-------------+ +-------------+

[Row 2: Mobile Views, y: 1760 (Aligned directly beneath Desktop counterparts)]
x: 40   x: 470  x: 900  x: 1540 x: 1970 x: 3040         x: 4540         x: 6040         x: 7540         x: 9040         x: 10540
+-----+ +-----+ +-----+ +-----+ +-----+ +-------------+ +-------------+ +-------------+ +-------------+ +-------------+ +-------------+
| M-DM| | M-Ls| | M-Pf| | M-Gr| | M-Sh| | Mobile Disc | | Mobile Set  | | Mobile Auth | | Mobile My   | | Mobile New  | | Mobile New  |
|     | |     | | Sht | |     | |     | |             | |             | |             | | Profile Sht | | Group Sht   | | Chat Sht    |
| 390 | | 390 | | 390 | | 390 | | 390 | | (390×844)   | | (390×844)   | | (390×844)   | | (390×844)   | | (390×844)   | | (390×844)   |
+-----+ +-----+ +-----+ +-----+ +-----+ +-------------+ +-------------+ +-------------+ +-------------+ +-------------+ +-------------+

[Row 3: Tokens & Components, y: 2680]
x: 40
+-----------------------------------------------------------------------------------------------------------------------------+
| Design Tokens & UI Component Library (1440 × 1120)                                                                       |
| [Swatches] [Typography Scale] [Vector Icons] [Chat Atoms] [Reactions / Hover Bar] [Rail Menu Popover] [Connection Banner]   |
+-----------------------------------------------------------------------------------------------------------------------------+
```

### Detailed Screen Pair Specifications

1. **Pair 1: Direct Messages (1:1 Chat)**
   * **Desktop (`1440 × 900`)**: 3-pane workstation. Left rail (68px) with 4 core tabs (Chats, Groups, Contacts, Discover), conversation list sidebar (312px) with search and filter tabs, active chat thread (764px) with quoted reply and paper plane send button, and contact info drawer (296px) with wrapped bio card, "Remove Contact" neutral secondary action, and "Block <Name>" danger action.
   * **Mobile (`390 × 844`)**:
     - `Mobile — Conversation List`: Top Orbit header, search trigger, horizontal filter chips, touch chat cards with community avatars, and fixed bottom navigation bar (`Chats`, `Groups`, `Discover`, `Profile`).
     - `Mobile — Direct Messages`: Full-width thread with `←` back button, contact presence header, touch message bubbles, overlapping double-tick receipt, and bottom composer dock.
     - `Mobile — User Profile Sheet` (at `x: 900`): Slide-up bottom sheet triggered by the `(i)` button in `Mobile — Direct Messages`. Contains 68px avatar with online status, Ananya Roy identity, quick actions ("Mute Notifications", "Send Direct Message"), wrapped bio card, mutual groups chips, membership metadata, neutral secondary "Remove Contact" (Unfriend) action, and "Block User" destructive action.

2. **Pair 2: Group Chat & Communities**
   * **Desktop (`1440 × 900`)**: Group chat workstation. Top header with group community photo badge and topic pill, pinned message banner, AI Assistant `/summary` response card, member role list with Admin badges, wrapped group description card, and Leave Group action.
   * **Mobile (`390 × 844`)**:
     - `Mobile — Group Chat`: Compact mobile header with group avatar badge, pinned banner with wrapped text, touch message thread with read receipts, and mobile composer.
     - `Mobile — Group Context Sheet`: Slide-up bottom sheet with drag handle, large 60px group community badge, description, members preview, and leave group action.

3. **Pair 3: Group Discovery Hub (`/discover`)**
   * **Desktop (`1440 × 900`)**: Public discovery directory with search bar, topic tag filter chips (`#java-spring`, `#interview-prep`, `#system-design`, `#frontend-angular`), 6-card responsive grid with custom group community photo badges, clean member metrics ("42 members"), wrapped descriptions, and "+ Create Group" button.
   * **Mobile (`390 × 844`)**: Mobile discovery feed with search bar, scrolling topic chips, single-column card stack with rich community badges, and fixed bottom navigation bar.

4. **Pair 4: User Profile & Account Settings**
   * **Desktop (`1440 × 900`)**: Full standalone settings page (`x: 4540`). Sub-menu (Public Profile, Account & Security, Appearance, Notifications), avatar upload section (Cloudflare R2), display name, verified email, bio textarea, and save changes action.
   * **Mobile (`390 × 844`)**: Mobile profile tab view with avatar change trigger, display name, email, wrapped bio card, theme switcher card, notification toggles, and sign out button.

5. **Pair 5: Authentication (Sign In & Register)**
   * **Desktop (`1440 × 900`)**: Split-screen design. Left brand showcase panel highlighting latency, topic discovery, and AI features; right elevated authentication card with tab switcher, form inputs, and JWT security notice.
   * **Mobile (`390 × 844`)**: Centered mobile authentication card with tab toggle, form fields, and submit button.

6. **Pair 6: In-Context "My Profile" (Modal & Sheet)**
   * **Desktop (`1440 × 900`) at `x: 7540`**: Direct replacement for `SelfProfileModalComponent`. Renders the active workspace dimmed by a 72% dark backdrop overlay. Centered modal card (500 × 620px) featuring:
     - Top amber accent line and dark header banner.
     - 80px Avatar overlapping banner with amber ring, online status dot, and "Change Photo" action (Cloudflare R2).
     - Display Name ("Satyam Kumar"), "Associate Engineer" badge, verified email badge.
     - Bio card with multiline wrapped description.
     - 2×2 Metadata grid: Member Since, GitHub Linked Identity, Joined Groups (4 Communities), Session Security (15-min JWT).
     - Footer CTAs: "Edit Profile & Bio" (Primary amber) and "Sign Out" (Rose outline).
   * **Mobile (`390 × 844`) at `x: 7540`**: In-context slide-up bottom sheet over the conversation list. Includes drag handle, 68px avatar, R2 upload trigger, wrapped bio, 2×2 metadata cards, and full-width action buttons.

7. **Pair 7: Create Group / Space (Modal & Sheet)**
   * **Desktop (`1440 × 900`) at `x: 9040`**: Dedicated modal overlay triggered from `+ Create Group` in Discovery and Groups. Contains R2 avatar upload box, Space Name input, Topic Tag input, multiline Description textarea, Public vs Private Space selector cards, and "Create Space" action.
   * **Mobile (`390 × 844`) at `x: 9040`**: Bottom sheet with drag handle, R2 avatar upload trigger, touch input fields, Public/Private switcher, and primary "Create Space" button.

8. **Pair 8: New Chat & Contacts (Modal & Sheet)**
   * **Desktop (`1440 × 900`) at `x: 10540`**: Dedicated modal overlay triggered from `+ New` in the Direct Messages sidebar. Structured with segmented tabs:
     - **Direct Message (My Contacts)**: Lists existing connected contacts with live presence indicators and primary amber `Message` buttons (which immediately route to the 1:1 chat thread).
     - **Add Connection / Discover**: Dedicated search and suggested users list with `+ Connect` and `Pending...` request states.
     - Footer guidance banner prompting users to switch tabs for peer discovery.
   * **Mobile (`390 × 844`) at `x: 10540`**: Bottom sheet with search input, `SUGGESTED PEOPLE` section header (distinguishing non-connected peers from established contacts), connection request actions (`+ Connect`, `Pending`), and touch targets.

9. **Design Tokens & UI Component Library (`1440 × 1120`, `y: 2680`)**
   * Official Orbit color token hierarchy (Carbon Graphite & Warm Amber).
   * Typography scale.
   * Vector icon library: Overlapping double-tick (`stroke-width: 1.8`), paper plane send icon, chat square, users, compass, search, paperclip, smile, pin, info, settings, and theme toggle.
   * Chat message atoms with wrapped text, quoted replies, smart reply pills, and presence indicators.
   * Message hover context bar with emoji reaction badges (`👍 3`, `🔥 1`).
   * User rail popover menu (replacement for Angular's `.user-dropdown-menu`).
   * Connection request action banner (Accept / Decline / Block).
   * File and media attachment card (Cloudflare R2 download & preview).
