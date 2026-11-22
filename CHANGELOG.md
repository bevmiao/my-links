# Changelog

All notable changes. Newest first. Format loosely follows Keep a Changelog.

## [Unreleased] — Part One (development)

### Added
- Development environment in `wrangler.jsonc` (`env.dev`): separate Worker (`my-links-dev`), D1 (`my-links-db-dev`), R2 (`my-links-assets-dev`), and dev hostnames.
- Project documentation: `CONTEXT.md`, `INSTRUCTIONS.md`, `DEVELOPMENT.md`, `.env.example`, `CHANGELOG.md`.

### Changed
- Request body size limits now enforce while streaming (`readBodyCapped`), so missing or false `Content-Length` headers cannot force buffering. Applies to JSON bodies and image uploads.
- `ADMIN_EMAILS` set to the owner's address as a defence-in-depth allowlist.

### Infrastructure
- Created D1 `my-links-db-dev` and R2 `my-links-assets-dev`. Applied migration 0001 to the dev database. Production resources were not modified.

## [0.1.0] — Baseline (pre-upgrade)

- Link-in-bio site: public profile, owner dashboard behind Cloudflare Access, D1 storage, R2 images, click and view analytics.
