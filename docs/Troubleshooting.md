# Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "This account cannot sign in here" | The Google / e-mail account was not created by the admin, is disabled, or its e-mail changed in Firebase | Admin → Accounts: create or enable it; check the Audit log (`auth.denied`, reason) |
| Google pop-up closes immediately | Pop-ups blocked, or the domain is missing from Firebase *Authorized domains* / the API key referrers | Allow pop-ups; add the domain in Firebase Auth and in the API key restrictions |
| "Requests from referer … are blocked" in the console | The site runs on a domain the browser API key does not allow | Add the domain to the key's HTTP referrers (Google Cloud → Credentials) |
| Every page shows "Unavailable" | Server configuration missing (`APP_ORIGIN`, `RATE_LIMIT_SECRET`, Firebase Admin variables) or Firestore unreachable | Check the Vercel variables (Production) and the logs (`page_context_unavailable` with a code) |
| Every API answers 500 right after a dependency update | `jose` 6 (ESM-only) loaded by `jwks-rsa` on Vercel: `ERR_REQUIRE_ESM` | Keep `"overrides": { "jose": "5.10.0" }`; `tests/deps.test.ts` guards it |
| API answers `503 service_unavailable` | Firestore daily quota reached, or a transient outage | Wait for the quota reset (midnight Pacific time); see Firebase console → Usage |
| API answers `429 rate_limited` | Too many requests of one kind (see `Retry-After`) | Wait; heavy reads (search, deep pages, export) have the tightest limits |
| `9 FAILED_PRECONDITION` in logs | A query needs an index that is missing or still building | `firebase deploy --only firestore:indexes`; wait until the index is READY |
| Badge says "Changed in another tab" | The same day was saved from another tab or device | Reload the note; the newer text wins |
| Badge says "Not saved · retrying" for long | Offline or the server is failing; retries back off up to 2 min, at most 8 times | Copy your text somewhere safe, check the connection, reload |
| Cannot type into an earlier day | Earlier days are locked by design | Export the note, edit the file, import it as a new note |
| Import says "dated after today" | A `## YYYY-MM-DD` heading is in the future in your time zone | Fix the date (or your time zone under Preferences) and import again |
| Import stopped halfway | Daily write quota or rate limit reached | Run the same import again later; notes already imported are skipped |
| Local `next build` fails with "--env-file= is not allowed in NODE_OPTIONS" | Next passes Node flags to its workers | Use `node --env-file=<file> scripts/with-env.mjs build` |
| `pr-only` CI job red on `main` | A commit reached `main` without a pull request | Revert it through a pull request; never push to `main` directly |
| Firestore created in the US by `firebase deploy` | Deploying rules before creating the database | Delete the empty database and create it in the right region before deploying (the id is reusable after a few minutes) |
| PR shows "Vercel – GitHub couldn't verify an account for the commit" | By design: commits are authored as `Lumen Quill <dev@lumen-quill.invalid>` (no personal identity in the public history), and Vercel Hobby only builds commits of a known account. Only the preview is affected; previews do not run anyway (no `APP_ORIGIN`). Production deploys the merge commit on `main` | Nothing to do |
