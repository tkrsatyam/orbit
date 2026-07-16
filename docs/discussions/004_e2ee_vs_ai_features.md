# 004 — End-to-End Encryption vs AI Features

> **Format:** Architecture Decision Record (ADR)  
> **Reference:** https://adr.github.io  
> **Date:** 2026-06-27  
> **Status:** Accepted  

---

## Context

Privacy and data encryption are legitimate concerns in any messaging application. High-profile legal cases involving large technology companies have drawn public attention to how chat platforms handle message data — specifically whether messages are readable by the platform operator or only by the communicating parties.  

End-to-end encryption (E2EE) is the gold standard for private messaging. Signal pioneered it. WhatsApp adopted the Signal Protocol. It means messages are encrypted on the sender's device and can only be decrypted by the recipient's device. The server never sees plaintext content.  

Orbit's planned Phase 4 features include server-side AI capabilities: message summarisation, an AI assistant bot, smart reply suggestions, message translation, and tone checking. These features require the server to read and process message content.  

These two requirements are architecturally incompatible. A decision was required.  

---

## Options Considered

### Option 1 — Implement End-to-End Encryption

Encrypt messages on the client device before transmission. Server stores and routes ciphertext only. Decrypt on the recipient's device.  

**Pros:**
- Maximum privacy — operator cannot read messages
- Aligns with Signal's gold standard
- Strong security story for users

**Cons:**
- Directly incompatible with all planned AI features:
    - `/summary` requires server to read message content
    - `@ask` requires server to process conversation context
    - Smart replies require server to analyse incoming messages
    - Translation requires server to read and process text
    - Tone checker requires server to analyse outgoing text
- Key management is a significant engineering problem:
    - Key generation and secure storage per device
    - Key exchange protocol between users before first message
    - Key rotation on new device login
    - Lost device = lost message history permanently
- Group message E2EE is a research-level problem:
    - Each message must be encrypted for every group member
    - Or implement Sender Keys protocol (Signal's solution, years of cryptographic research)
- Multi-device support breaks without secure key backup, itself a hard problem  
- No server-side search — encrypted content cannot be indexed
- Eliminates message search feature planned for Phase 3

### Option 2 — Server-Side Processing with Security Baseline (Chosen)

Do not implement E2EE. Secure all data with encryption in transit and at rest. Implement robust auth. Document the tradeoff transparently.  

**Pros:**
- All Phase 4 AI features remain fully viable
- Message search (Phase 3) remains viable
- No key management complexity
- Security baseline is still meaningful and honest
- Transparent documentation of the tradeoff is itself a demonstration of architectural maturity  

**Cons:**
- Server can read message content
- Not suitable for highly sensitive communications
- Privacy-conscious users may prefer E2EE alternatives

---

## Decision

Orbit does **not** implement end-to-end encryption.

This is a deliberate architectural tradeoff, not an oversight. E2EE and server-side AI features are fundamentally incompatible — the server cannot summarise, translate, or assist with content it cannot read.

Orbit's value proposition is AI-augmented group communication for people with shared goals. That value proposition requires server-side message processing. Implementing E2EE would eliminate the core differentiating feature set.

### Security Baseline Implemented

The following security measures are in place:

| Layer                 | Implementation                                |
|-----------------------|-----------------------------------------------|
| Encryption in transit | TLS enforced by Vercel and Render             |
| Password security     | BCrypt hashing, cost factor 12                |
| Authentication        | JWT, access token 15min, refresh token 7 days |
| Encryption at rest    | MongoDB Atlas                                 |
| Input validation      | Server-side validation on all endpoints       |

### Recruiter / Interviewer Answer

If asked about encryption or privacy:

> "Orbit uses TLS for encryption in transit, BCrypt for
> credential security, and relies on managed database
> providers that encrypt data at rest. It does not implement
> end-to-end encryption — a deliberate tradeoff. E2EE is
> architecturally incompatible with server-side AI features
> like message summarisation and the @ask assistant. Signal
> can offer E2EE because it has no server-side intelligence.
> Orbit's value proposition requires the server to process
> message content. This tradeoff is documented explicitly
> in the architecture decisions."

---

## Drawbacks Acknowledged

- Messages are readable by the platform operator (the developer)
- Not appropriate for highly sensitive or confidential communications
- Users who require E2EE should use Signal or WhatsApp
- Platform is subject to legal data requests since plaintext is accessible server-side

---

## Evolution Path

The fundamental incompatibility between server-side AI and E2EE is a current constraint of where AI technology sits today.  

Two paths could change this in future:

1. **On-device AI models** — if sufficiently capable AI models run locally on the user's device (as Apple Intelligence demonstrates is directionally viable), AI features could process message content client-side before encryption. This would make E2EE and AI features compatible.

2. **Homomorphic encryption** — a cryptographic technique allowing computation on encrypted data without decrypting it. Currently too computationally expensive for real-time use but an active area of research.

Either evolution would allow revisiting this decision without requiring a fundamental rearchitecture of the messaging system.

---

## References

- Signal Protocol — https://signal.org/docs
- WhatsApp E2EE Technical Overview
- Apple Intelligence on-device processing model
- Meta privacy lawsuits — context for public expectations around messaging platform privacy  