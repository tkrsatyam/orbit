# 005 — Database Strategy: Pure MongoDB vs PostgreSQL + MongoDB

> **Format:** Architecture Decision Record (ADR)  
> **Reference:** https://adr.github.io  
> **Date:** 2026-06-27  
> **Status:** Accepted

---

## Context

Orbit requires persistent storage for several distinct data domains:

- **User accounts** — profiles, credentials, settings
- **Contacts** — connection requests, contact lists, blocks
- **Groups** — group metadata, membership, roles
- **Conversations** — direct message conversation records
- **Messages** — the primary write-heavy data, with reactions and read receipts
- **Files** — metadata for uploaded images and files (binaries stored in Cloudflare R2)  
- **Notifications** — unread counts and alert records

The question was whether to model this across two databases (PostgreSQL for relational entities, MongoDB for documents) or commit fully to one.  

### Real-World Reference

The developer observed a large multinational insurance company's enterprise platform storing complex, deeply nested domain data — policies, claims, financial records, product offerings — entirely in MongoDB. This is a production system operating at significant scale with no relational database involved.  

This observation informed the evaluation: if an enterprise domain with complex relational-like data (policies referencing customers referencing products referencing financial instruments) is handled effectively in MongoDB, the case for a hybrid approach weakens.  

---

## Options Considered

### Option 1 — PostgreSQL + MongoDB (Split)

Use each database for the data it is naturally suited for.

```
PostgreSQL  ← users, contacts, groups, conversations
MongoDB     ← messages, reactions, read receipts, notifications
```

**Pros:**
- Each database handles its natural fit
- PostgreSQL enforces referential integrity via foreign keys
- JPA and familiarity from prior project reduces ramp-up
- Clear separation of concerns between data types

**Cons:**
- Two database connections to manage
- Two sets of schemas and migrations to maintain
- More complex Docker Compose locally
- Two Atlas/Neon free tier accounts to manage in production
- Spring Data JPA + Spring Data MongoDB simultaneously in one project — potential configuration conflicts  
- Operationally more complex for a solo developer

### Option 2 — Pure PostgreSQL

Use PostgreSQL for all data including messages.

**Pros:**
- Maximum familiarity — known from prior project
- Strong referential integrity everywhere
- ACID transactions across all operations

**Cons:**
- Messages are poorly suited to a relational model — variable shape (text, image, file), nested reactions, read receipts per member  
- Write performance at scale is lower than MongoDB for document-shaped, high-volume data  
- Schema migrations required for every message structure change (adding new message types, reaction formats)  

### Option 3 — Pure MongoDB (Chosen)

Use MongoDB for all data, modelling relational concepts at the application layer.  

**Pros:**
- Single database — one Atlas cluster, one connection, one Spring Data dependency  
- Messages, reactions, and read receipts modelled naturally as nested documents  
- Schema flexibility — new message types and fields require no migrations  
- Write-optimised — handles high-volume message inserts well
- Horizontal scaling built in via native sharding
- Consistent developer experience across all data domains
- Real-world validation: enterprise production systems handle complex relational-like data in MongoDB at scale  
- Stronger interview talking point — demonstrates NoSQL architectural thinking beyond the obvious hybrid answer  

**Cons:**
- No native foreign keys — referential integrity enforced in application service layer  
- Multi-document transactions more complex than JPA transactions  
- Aggregation pipelines more verbose than SQL joins
- Spring Data MongoDB differs from Spring Data JPA — learning overhead for queries and aggregations  
- Risk of data inconsistency if service-layer integrity logic has bugs  

---

## Decision

Orbit uses **pure MongoDB** for all persistent data storage.

MongoDB Atlas free tier hosts the production cluster.  
Docker with MongoDB image hosts the local development instance.  
Spring Data MongoDB handles all data access.  

### Collection Structure

```
users               ← credentials, profile, settings
contacts            ← connection requests, contact list, blocks
groups              ← group metadata, member references, roles
conversations       ← DM conversation records, participant references
messages            ← all messages with nested reactions,
read receipts, file references
notifications       ← unread counts, mention alerts
```

### Referential Integrity Strategy

In the absence of foreign key constraints, integrity is enforced at the service layer via the following conventions:

**On user deletion:**
- Remove user from all group member arrays
- Mark user's messages as deleted (soft delete, preserve conversation continuity)  
- Remove all contact relationships
- Delete all conversation records where user is a participant

**On group deletion:**
- Delete all messages in the group's conversations
- Remove group from all member references

**On message deletion:**
- Soft delete — set `deleted: true`, clear content
- Preserve document for read receipt and reaction integrity

All multi-step operations that must be atomic use MongoDB multi-document transactions.  

### Referential References Pattern

Instead of foreign keys, collections reference each other by ID:

```javascript
// Group document
{
  _id: ObjectId,
  name: "FAANG Interview Prep",
  memberIds: [ObjectId, ObjectId, ...],  // references users
  adminIds: [ObjectId],
  conversationId: ObjectId               // references conversations
}

// Message document
{
  _id: ObjectId,
  conversationId: ObjectId,             // references conversations
  senderId: ObjectId,                   // references users
  content: "Has anyone tried the...",
  type: "TEXT",
  reactions: [
    { userId: ObjectId, emoji: "👍" }   // embedded, not referenced
  ],
  readBy: [ObjectId],                   // embedded array of userIds
  deleted: false,
  createdAt: ISODate,
  editedAt: ISODate
}
```

Reactions and read receipts are embedded within the message document — they have no independent existence and are always accessed in the context of their message.  

---

## Drawbacks Acknowledged

- No database-level referential integrity — bugs in service layer integrity logic can produce inconsistent data silently  
- Multi-document transactions carry performance overhead — used sparingly for critical multi-step operations only  
- Aggregation pipelines are more verbose and harder to debug than equivalent SQL joins  
- Spring Data MongoDB differs meaningfully from Spring Data JPA — queries, transactions, and relationship handling all work differently  

---

## Evolution Path

1. **Integrity monitoring** — if data inconsistency becomes a recurring issue, introduce periodic consistency check jobs that scan for orphaned documents and flag or repair them.  

2. **Hybrid approach** — if the application-layer integrity burden becomes unsustainable, user and group data could be extracted to PostgreSQL while messages remain in MongoDB. Clean service boundaries make this extraction surgical.  

3. **Sharding** — if message volume grows significantly, MongoDB's native sharding on `conversationId` distributes load horizontally without application changes.  

---

## References

- MongoDB Documentation — https://www.mongodb.com/docs
- Spring Data MongoDB — https://spring.io/projects/spring-data-mongodb
- Discord Engineering — "How Discord Stores Billions of Messages"
  (MongoDB → Cassandra migration at extreme scale)
- MongoDB Atlas Free Tier — https://www.mongodb.com/atlas
- Enterprise production reference: large-scale insurance platform storing policies, claims, and financial records in MongoDB without a relational database layer  