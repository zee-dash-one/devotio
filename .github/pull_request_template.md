## Summary

<!-- What changed and why -->

## How to test

<!-- Steps for reviewers -->

## Checklist

- [ ] Lint, typecheck, and tests pass (`npm run lint`, `npm run typecheck`, `npm run test`; `npm run build:ready` if the web bundle changed)
- [ ] If this PR changes `packages/backend` (schema, Convex functions, or generated API): **pilot backend deployed before merge** — run `npm run deploy:backend` against `dev:upbeat-jellyfish-720`, verify with `npx convex function-spec --deployment upbeat-jellyfish-720` (and smoke-check the app). See [docs/operations.md — Topologia de publicação](../docs/operations.md#1-topologia-de-publicação). Do **not** use `npm run deploy:backend:prod` for the live pilot.
- [ ] If this PR touches devotional image generation or manifests: follow [docs/operations.md — artes compartilháveis](../docs/operations.md#3-operação-das-artes-compartilháveis-do-devocional) after backend deploy (optional image prep before merge when applicable)
