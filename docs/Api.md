# API

All endpoints are under `/api`, answer JSON (`Cache-Control: no-store`, CSP `default-src 'none'`) and use the session cookie. Errors are `{ "error": "<code>" }` with a matching status, and never include internals.

**Legend:**
- **M**: mutation. It needs an `Origin` equal to `APP_ORIGIN`, a JSON body with `Content-Type: application/json`, and a strict schema.
- **U**: signed-in user.
- **A**: administrator (custom claim **and** profile role).
- **RL**: rate-limit rule (`server/security/rate-limit.ts`).

## Auth

| Method | Path | Access | RL | Purpose |
|---|---|---|---|---|
| POST | `/api/auth/session` | M, public | session (per IP, after token verification) | Exchange a fresh Firebase ID token (≤ 5 min old, verified e-mail) for the HttpOnly session cookie. Only admin-created accounts get one |
| POST | `/api/auth/logout` | M | – | Clear the cookie |
| POST | `/api/auth/logout-all` | M, U | – | Revoke every session of the account |
| GET | `/api/auth/me` | public | – | `401` when signed out; the session watcher polls it every 5 min |

## Notes

| Method | Path | Access | RL | Purpose |
|---|---|---|---|---|
| GET | `/api/notes?page=N` / `?q=text` | U | search; heavyRead for page > 5 | Archive page (20, creation order) or title search |
| POST | `/api/notes` | M, U | write | Create a note |
| GET | `/api/notes/write-target` | U | – | Note "Write today" continues, today's date, preference |
| GET | `/api/notes/{id}` | U (owner) | – | Note with every dated entry and the server's "today" |
| PATCH | `/api/notes/{id}` | M, U (owner) | write | Rename |
| DELETE | `/api/notes/{id}` | M, U (owner) | write | Delete the note and its entries; `?ifEmpty=1` deletes only a note with nothing written |
| PUT | `/api/notes/{id}/entries/{day}` | M, U (owner) | save (in memory) | Save today's text (`day` must be today, else `403 day_locked`; `409 conflict` on a newer version; empty text removes the day) |
| DELETE | `/api/notes/{id}/entries/{day}` | M, U (owner) | write | Delete one day |
| GET | `/api/home/overview` | U | – | Totals, streak, five newest notes |
| GET | `/api/home/notes?cursor=` | U | – | Every dated entry, newest first (20 per page) |

## Account

| Method | Path | Access | RL | Purpose |
|---|---|---|---|---|
| PUT | `/api/account/settings` | M, U | write | Mode, time zone, new-day behaviour, text size, Home tab |
| PUT | `/api/account/username` | M, U | account | Change username (unique; once per 7 days) |
| GET | `/api/account/password` | U | – | Whether the account has a password |
| POST | `/api/account/password` | M, U | account | Create a password for an account without one (sign-in ≤ 10 min old; revokes sessions) |
| PUT | `/api/account/avatar` | M, U | account | Upload a 256 px JPEG (data URL; magic bytes and ≤ 90 KB checked) |
| DELETE | `/api/account/avatar` | M, U | account | Remove the photo |
| GET | `/api/avatar/{uid\|me}` | U (own) / A (any) | – | Photo bytes (`image/jpeg`, nosniff, CSP `default-src 'none'; sandbox`) |

## Data

| Method | Path | Access | RL | Purpose |
|---|---|---|---|---|
| GET | `/api/data/export?format=md\|txt[&noteId=]` | U | export (10 / hour) | Download everything or one note |
| POST | `/api/data/import` | M, U | import (400 chunks / hour) | One chunk of parsed notes (≤ 50 notes, ≤ 1.5 MB); duplicates of earlier imports are skipped |
| POST | `/api/data/delete-all` | M, U | destructive | Delete every note (`{"confirm":"DELETE ALL"}`) |

## Admin

| Method | Path | Access | RL | Purpose |
|---|---|---|---|---|
| GET | `/api/admin/users` | A | – | Accounts with photo version, providers, note counts |
| POST | `/api/admin/users` | M, A | adminChange | Create an account (always role `user`) |
| PATCH | `/api/admin/users/{uid}` | M, A | adminChange | Disable / enable (not yourself, not an admin) |
| DELETE | `/api/admin/users/{uid}` | M, A | destructive | Delete an account and all its notes (`{"confirm":"DELETE"}`) |
| POST | `/api/admin/users/{uid}/revoke` | M, A | adminChange | Sign an account out everywhere |
| POST | `/api/admin/revoke-all` | M, A | destructive | Sign every other account out (`{"confirm":"SIGN OUT ALL"}`) |
| GET | `/api/admin/stats` | A | heavyRead | Totals and daily activity |
| GET | `/api/admin/security` | A | – | Live security checks (reads the Firebase Auth configuration) |
| GET | `/api/admin/audit?cursor=` | A | – | Audit log, 50 per page |
| GET / PUT | `/api/admin/retention` | A / M, A | adminChange | Statistics and audit retention (1/3/7/30 days); PUT purges at once |
| GET | `/api/admin/backup?cursor=&from=&to=` | A | backup | One backup page (profiles on the first page, 25 notes per page) |

## Cron

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/cron/cleanup` | `Authorization: Bearer $CRON_SECRET` (constant-time; fails closed) | Daily purge: rate-limit counters, statistics, audit log, empty notes |

## Route files

Every route file under `app/api` (the docs test checks this list):

```
account/avatar
account/password
account/settings
account/username
admin/audit
admin/backup
admin/retention
admin/revoke-all
admin/security
admin/stats
admin/users
admin/users/[uid]
admin/users/[uid]/revoke
auth/logout
auth/logout-all
auth/me
auth/session
avatar/[uid]
cron/cleanup
data/delete-all
data/export
data/import
home/notes
home/overview
notes
notes/[id]
notes/[id]/entries/[day]
notes/write-target
```
