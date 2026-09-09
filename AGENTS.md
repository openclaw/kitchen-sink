# AGENTS.md

Work from repo root. Keep changes small and commit/push them to `main` when asked.

## Release

- npm package: `@openclaw/kitchen-sink`.
- Trusted publisher: GitHub Actions, repository `openclaw/kitchen-sink`, workflow `release.yml`.
- Do not publish npm releases locally. Cut releases by bumping `package.json`/`package-lock.json`, syncing generated surface files, pushing `main`, creating an annotated `vX.Y.Z` tag, pushing the tag, then publishing the GitHub release with `gh release create vX.Y.Z --verify-tag --generate-notes --title vX.Y.Z`.
- The `release.yml` workflow owns npm publishing through OIDC trusted publishing. Keep `permissions.id-token: write`; do not add `NODE_AUTH_TOKEN` or long-lived npm token secrets for publish.
- ClawHub release publishing is enabled through the canonical reusable ClawHub workflow. Keep `permissions.id-token: write` and continue passing the `CLAWHUB_TOKEN` secret for release publishes.

## Validation

- Use Node 24.16.0 or a newer Node 24 patch release.
- Before release commits, run `npm run check`, `npm run plugin:inspect:runtime`, `npm run pack:check`, and `git diff --check`.
- Generated surface files are expected to change when the package version changes; run `npm run sync:surface`.
