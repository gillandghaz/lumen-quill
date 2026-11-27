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
5. **Commit** in English, [Conventional Commits](https://www.conventionalcommits.org/) style: `feat(scope): ...`, `fix(...)`, `docs(...)`, `chore(...)`, `test(...)`.
6. **Pull request** to `main` with the PR template. Wait for CI to be green (`verify`, `osv-scanner`, `gitleaks`), then merge and delete the branch. Vercel deploys `main` automatically; preview deployments are built for every PR.

> GitHub only enforces branch protection on private repositories with a paid plan. Here the rule is kept by this workflow, the pre-push hook and CI, the same way as in the owner's other private projects.

## Security

Do **not** report vulnerabilities in public issues; see [SECURITY.md](SECURITY.md).
