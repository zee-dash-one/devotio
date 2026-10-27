## Summary

<!-- What changed and why -->

## How to test

<!-- Steps for reviewers -->

## Checklist

- [ ] Lint, typecheck, and tests pass (`npm run lint`, `npm run typecheck`, `npm run test`; `npm run build:ready` if the web bundle changed)
- [ ] If this PR changes `packages/backend` (schema, Convex functions, or generated API): **pilot backend deployed before merge** — run `npm run deploy:backend` against `dev:upbeat-jellyfish-720`, verify with `npx convex function-spec --deployment upbeat-jellyfish-720` (and smoke-check the app). See [README — Publicar e verificar](../README.md#publicar-e-verificar-piloto-pré-beta) and [docs/operations/release.md](../docs/operations/release.md). Do **not** use `npm run deploy:backend:prod` for the live pilot.
- [ ] If this PR touches devotional image generation or manifests: follow [docs/operations/devotional-images.md](../docs/operations/devotional-images.md) after backend deploy (optional image prep before merge when applicable)
