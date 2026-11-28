# Operations

## 1. Setting up from scratch

1. **Firebase project** (Spark plan is enough).
   - Create **Firestore** in the region closest to your Vercel region *before* any `firebase deploy`. Otherwise `firebase deploy` creates the database in the default US location, and that location cannot be changed.
   - In **Authentication**, enable **Email/Password** and **Google**.
2. **Lock Firebase Auth** (Identity Toolkit admin API or console):
   - block self sign-up (`client.permissions.disabledUserSignup`);
   - block self account deletion;
   - turn on e-mail enumeration protection;
   - enforce a password policy with a minimum length of 12;
   - keep anonymous and phone sign-in off;
   - add the production domain to **Authorized domains**.
3. **Rules and indexes:** `firebase deploy --only firestore:rules,firestore:indexes`.
4. **Service account key** (IAM → the `firebase-adminsdk` account → new JSON key). Put its values in the secrets file outside the repo, with `private_key` on one line and newlines written as `\n`. Delete the JSON file afterwards.
5. **Restrict the browser API key** (Google Cloud → Credentials):
   - HTTP referrers: the production domain, `<project>.firebaseapp.com` and `localhost:3000`;
   - APIs: Identity Toolkit and Token Service only.
6. **Vercel:** import the repository, region `sin1`, Node 24, and set the variables below for **Production**. Secret values are typed `sensitive`.
7. **Administrator:** `node --env-file=<secrets file> scripts/bootstrap-admin.mjs` (uses `ADMIN_EMAIL`, `ADMIN_USERNAME`).
8. **Check:** sign in, then open **Settings → Admin → Security**. Every check must be green.

## 2. Environment variables

| Name | Where | Secret | Meaning |
|---|---|---|---|
| `FIREBASE_PROJECT_ID` | server | no | Firebase project id |
| `FIREBASE_CLIENT_EMAIL` | server | **yes** | Service account e-mail |
| `FIREBASE_PRIVATE_KEY` | server | **yes** | Service account private key (one line, `\n` escaped) |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | browser (build time) | no (public by design; restricted by referrer and API) | Web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | browser | no | `<project>.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | browser | no | project id |
| `APP_ORIGIN` | server | no | Exact site origin(s), comma separated; used by the CSRF check. Required in production |
| `RATE_LIMIT_SECRET` | server | **yes** | ≥ 32 random characters; hashes rate-limit keys. Required in production |
| `CRON_SECRET` | server | **yes** | ≥ 32 random characters; Vercel Cron sends it as a bearer token |
| `ADMIN_EMAIL`, `ADMIN_USERNAME` | bootstrap script only | no | The single administrator |

Locally, keep them in a file **outside** the project and run `node --env-file=<file> scripts/with-env.mjs dev|build|start`. Next.js passes Node flags to its workers through `NODE_OPTIONS`, where `--env-file` is refused; the wrapper loads the file once instead. Never create `.env.local` in the project. `vercel link` creates one: delete it.

Preview deployments have no `APP_ORIGIN`, so the server refuses to run there (fail closed). Only production serves the app.

## 3. Deploy

Merging a pull request into `main` deploys production automatically (Vercel Git integration). CI must be green first: `verify`, `gitleaks`, `osv-scanner`. On `main`, `pr-only` also checks that the commit came from a pull request.

Releases: tag `vX.Y.Z` on `main`, publish a GitHub Release with the changelog entry, and create a `release/X.Y` branch from the tag.

## 4. Cron

`vercel.json` runs `GET /api/cron/cleanup` daily at 20:00 UTC (03:00 WIB). See [Database.md → Retention](Database.md#5-retention-and-clean-up).

## 5. Quotas and costs

| Service | Free limit | Lumen Quill's guard |
|---|---|---|
| Firestore reads | ≈ 50,000 / day | browser, router and profile caches; no prefetch on note links; heavy-read rate limits; Overview ≈ 8 reads |
| Firestore writes | ≈ 20,000 / day | autosave throttled (≥ 10 s apart while typing); autosave limiter kept in memory; imports chunked and de-duplicated |
| Firestore storage | 1 GiB | entry ≤ 200 KB, 1,000 days per note, 5,000 notes per account |
| Vercel Hobby | function and bandwidth limits | small JSON answers; static assets cached |
| Firebase Auth | generous on Spark | sign-in rate limit per IP |

If the daily Firestore quota is reached, the API answers `503 service_unavailable` until the quota resets (midnight Pacific time).

## 6. Backups

**Settings → Admin → Backup** (everything or a date range). Store the JSON encrypted, outside the cloud account. Users can also export their own notes as `.md` / `.txt`.

## 7. Monitoring

- **Settings → Admin → Security** (configuration), **Audit log** (sign-ins, refusals, admin actions) and **Statistics** (daily activity).
- Vercel → Logs: the server logs error names and codes only (`unhandled_error`, `datastore_unavailable`, `page_context_unavailable`, `cron_cleanup`).
- Firebase console → Usage: reads and writes per day.

## 8. Scripts

| Script | Purpose |
|---|---|
| `scripts/with-env.mjs` | Run `next dev|build|start` with secrets from a file outside the repo |
| `scripts/bootstrap-admin.mjs` | Create or repair the single administrator (idempotent; refuses a second admin) |
| `scripts/apply-rulesets.mjs` | Apply `.github/rulesets/*.json` (needs a public repository or GitHub Pro) |
| `scripts/hooks/pre-commit` | gitleaks on staged changes; refuses `.env*`, keys |
| `scripts/hooks/pre-push` | Refuses pushes to `main` |
