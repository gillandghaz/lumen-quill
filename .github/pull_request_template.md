## What & why

## Checklist
- [ ] `npm run lint && npm run typecheck && npm test && npm run build && npm run audit:deps` (0 vulnerabilities)
- [ ] Every new endpoint: Origin check (mutations) -> session -> rate limit -> strict Zod schema -> owner from session
- [ ] New security rule has a negative test
- [ ] No secrets, no `.env*` files, no note text in logs
- [ ] CHANGELOG updated
