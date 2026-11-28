# Contributing

**Lumen Quill is a private project** ([LICENSE](LICENSE)). Contributions come only from the owner or invited collaborators. This guide applies to people and AI assistants working on the repository.

## Workflow: every change goes through a pull request

`main` is what Vercel deploys to production. **Never push to `main` directly.**

1. **Set up once** (Node 24, see `.nvmrc`):
   ```bash
   npm ci
   git config core.hooksPath scripts/hooks   # pre-commit: gitleaks · pre-push: refuses direct pushes to main
   ```
   Secrets live in a file **outside** the project folder (names in `.env.example`). Run with
   `node --env-file=<file> scripts/with-env.mjs dev`. Never commit secrets, never create `.env.local` here.
2. **Branch** from an up-to-date `main`: `feat/...`, `fix/...`, `perf/...`, `chore/...`, `docs/...`, `security/...`.
3. **Check** before committing; everything must pass:
   ```bash
   npm run lint && npm run typecheck && npm test && npm run build && npm run audit:deps
   ```
   `npm audit` must report **0 vulnerabilities**.
4. **Document**: a new entry at the top of `CHANGELOG.md`, the version in `package.json` (`npm version <x.y.z> --no-git-tag-version`), and `README.md` / `SECURITY.md` when behaviour or controls change.
5. **Commit** in English, [Conventional Commits](https://www.conventionalcommits.org/) style: `feat(scope): ...`, `fix(...)`, `docs(...)`, `chore(...)`, `test(...)`, `ci(...)`. Commit identity in this repository: `Lumen Quill <dev@lumen-quill.invalid>` (no personal e-mail in a public history).
6. **Pull request** to `main` with the PR template. Wait for CI to be green (`verify`, `osv-scanner`, `gitleaks`), then merge and delete the branch. Vercel deploys `main` automatically; preview deployments are built for every PR.

7. **Release** (owner): tag `vX.Y.Z` on `main`, publish a GitHub Release with the changelog entry, and create `release/X.Y` from the tag.

## Repository protection

- Rulesets live in `.github/rulesets/`:
  - `main` needs a pull request and green CI (`verify`, `gitleaks`, `osv-scanner`), and cannot be force-pushed or deleted;
  - `release/*` branches are protected;
  - `v*` tags are immutable.

  Apply them with `GH_TOKEN=… node scripts/apply-rulesets.mjs <owner>/lumen-quill`. GitHub enforces rulesets on public repositories, or on private ones with GitHub Pro.
- The pre-push hook and the `pr-only` CI job keep the same rule locally and on `main`.
- GitHub Actions run with a read-only token. Only GitHub-owned actions and the pinned OSV action are allowed.

## Security

Do **not** report vulnerabilities in public issues; see [SECURITY.md](SECURITY.md).
