# Dependencies

Every version is pinned exactly (`package.json`, no ranges). `npm audit --audit-level=low` must report 0 vulnerabilities; OSV-Scanner runs in CI and Dependabot opens weekly update PRs.

## Runtime

| Package | Why |
|---|---|
| `next` | App Router, server rendering, API routes, proxy (nonce CSP), fonts self-hosted at build time |
| `react`, `react-dom` | UI; all user text is rendered as text nodes (no raw HTML) |
| `@firebase/app`, `@firebase/auth` | Browser sign-in only (Google pop-up, e-mail + password, reset e-mail); modular packages keep the bundle small |
| `firebase-admin` | Server: session cookies, ID token verification, account management, Firestore |
| `zod` | Strict validation of every request body and query |

## Development

| Package | Why |
|---|---|
| `typescript` (aliased to `@typescript/typescript6`) | Type checking (`strict`, `noUncheckedIndexedAccess`) with a version supported by `typescript-eslint` |
| `eslint`, `typescript-eslint` | Lint, layer boundaries, bans on raw HTML and `eval` |
| `vitest` | Tests |
| `@types/node` (Node 24), `@types/react`, `@types/react-dom` | Types |

## Overrides

| Package | Pin | Reason |
|---|---|---|
| `jose` | 5.10.0 | `firebase-admin → jwks-rsa` calls `require("jose")`; jose 6 is ESM-only and the Vercel runtime rejects it (`ERR_REQUIRE_ESM`, every API returned 500). Guarded by `tests/deps.test.ts` |

## Choosing a new dependency

Prefer none when the need is small. Otherwise check GitHub Advisories / `npm audit` and the release age (avoid brand-new releases), pin the exact version, and note the reason here.
