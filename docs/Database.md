# Database

Cloud Firestore (Native mode), database `(default)` in `asia-southeast1` (Singapore), on the **Spark** (free) plan. Only the server reads and writes it, through the Admin SDK.

## 1. Collections

| Collection | Document id | Fields (main) | Written by |
|---|---|---|---|
| `users` | Firebase uid | email, username, role, disabled, createdAt, createdBy, lastLoginAt, usernameChangedAt, avatarVersion, writing {lastDay, streak}, settings {mode, timeZone, nextDay, fontScale, homeTab} | sign-in, settings, admin, bootstrap script |
| `usernames` | username | uid | username changes (unique reservation, in a transaction) |
| `notes` | random 22 characters | ownerUid, title, createdAt, updatedAt, firstDay, lastDay, entryCount, words, bytes, preview, importHash? | notes service |
| `notes/{id}/entries` | `YYYY-MM-DD` | day, body, words, bytes, createdAt, updatedAt, ownerUid, noteId | notes service |
| `avatars` | uid | bytes (JPEG ≤ 90 KB), updatedAt | account |
| `activity` | `YYYY-MM-DD` | saves, newEntries, notes, words (blind increments) | notes service, for Statistics |
| `appSettings` | `retention` | statsDays, auditDays (1/3/7/30) | admin |
| `auditLogs` | auto | action, actorUid, targetUid?, at, details (ids/codes/counts only) | server |
| `rateLimits` | sha256(secret, scope, key) | count, windowStart, expiresAt | rate limiter (rules not marked `local`) |

## 2. Security rules

`firestore.rules` denies every read and write from clients. The Admin SDK used by the server bypasses rules by design.

```
match /{document=**} { allow read, write: if false; }
```

## 3. Indexes

`firestore.indexes.json` (deploy with `firebase deploy --only firestore:indexes`):

| Collection | Fields | Used by |
|---|---|---|
| notes | ownerUid ↑, updatedAt ↓ | legacy ordering (kept) |
| notes | ownerUid ↑, createdAt ↓ | Archive pages, search, Overview recent notes, export |
| notes | ownerUid ↑, lastDay ↓, createdAt ↓ | "Write today" target |
| notes | ownerUid ↑, words ↑ / ownerUid ↑, entryCount ↑ | Overview sums |
| notes | ownerUid ↑, importHash ↑ | duplicate detection on import |
| notes | entryCount ↑, createdAt ↑ | daily purge of empty notes |
| entries (collection group) | ownerUid ↑, day ↓, updatedAt ↓ | Home → Notes |

## 4. Quotas (Spark) and cost per action

Spark allows about **50,000 reads, 20,000 writes and 20,000 deletes per day**, and 1 GiB of storage.

| Action | Reads | Writes |
|---|---|---|
| Any signed-in request | 1 (profile; cached 15 s per instance) | 0 |
| Autosave | 3 (profile, note, entry) | 3 (note, entry, activity); +1 read/write on the first save of a day (streak) |
| Home → Overview | ≈ 8 | 0 |
| Home → Archive page | 21 (count + 20); deeper pages also pay for skipped rows | 0 |
| Home → Notes page | ≤ 41 (count + 20 entries + their notes); deeper pages also pay for skipped rows | 0 |
| Open a note | 1 + its days | 0 |
| Import | ≈ 1 per 30 notes (duplicate check) | 1 per note + 1 per day + 1 |
| Export everything | every note and day | 0 |

Browser and router caches avoid repeating reads when moving between tabs and menus (see [Architecture.md → Caching](Architecture.md#5-caching-quota)). Heavy reads (search, deep pages, export, statistics) are rate-limited.

## 5. Retention and clean-up

TTL policies need billing, so the daily cron (`/api/cron/cleanup`, 03:00 WIB) deletes:
- rate-limit counters past their window;
- `activity` days older than the statistics setting;
- `auditLogs` older than the audit setting;
- notes still empty 24 h after creation.

Changing a retention setting purges immediately.

## 6. Backups

**Admin → Backup** downloads every profile and every note with its entries as JSON, either everything or a date range. Restore is manual (re-create notes through the Data import, or with the Admin SDK).
