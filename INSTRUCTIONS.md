# INSTRUCTIONS — permanent development rules

These rules apply to every change. If a rule conflicts with a request, stop and ask.

## 1. Production protection (highest priority)

1. Never deploy to production (`my-links`, `links.flicksbymiao.com`) without the owner's explicit approval in the same conversation.
2. Never point development code at production D1 (`my-links-db`) or R2 (`my-links-assets`). Development uses `env.dev` only.
3. Never delete existing data, including D1 rows, R2 objects, and Worker versions. Destructive migrations need approval first.
4. Never change production DNS, Access policies, or routes without approval.
5. Never put secrets in source, docs, commits, or frontend bundles. `.dev.vars` and `.env*` are git-ignored.

## 2. Git workflow

- `main` is the baseline. Work on `dev` (or a feature branch cut from `dev`).
- Commit in small, reviewable steps with clear messages (imperative mood, a short summary, and a body when useful).
- Stage files explicitly. Do not commit line-ending-only changes. See DEVELOPMENT.md for the CRLF note.
- Never force-push shared branches. Never rewrite `main`.
- Update CHANGELOG.md with every user-visible change.

## 3. Architecture rules

- The Worker is authoritative for validation, authorization, and data access. The frontend validates only for user experience.
- Public and admin code paths are separate. Admin routes are never reachable on the public host (404), and admin hostname requests always require Access.
- Shared types and validation live in `shared/`. Do not duplicate schemas.
- Keep features modular. Each new content type gets its own table, its own validation, its own routes, and its own admin editor. Part Two must be addable without rebuilding these.
- Do not remove working functionality to simplify code.
- Do not add dependencies without a reason in the commit message. Prefer the platform and existing packages.

## 4. Naming conventions

- Files: `PascalCase.tsx` for React components, `camelCase.ts` for modules, `kebab-case` for SQL migrations (`0002_add_media.sql`) and docs.
- Database: `snake_case` tables and columns, plural table names, `id INTEGER PRIMARY KEY`, timestamps as `created_at` / `updated_at` in UTC.
- API: `/api/<resource>` for public reads, `/api/admin/<resource>` for admin. Use plural resource names and `kebab-case` for multi-word paths.
- Environment variables: `UPPER_SNAKE_CASE`.
- Tests: `<module>.test.ts` next to the suite in `test/`.

## 5. Security requirements

- Authentication: Cloudflare Access on the admin hostname plus Worker-side JWT verification. Fail closed when unconfigured.
- Authorization: every admin route checks identity. Public routes never return unpublished content or admin data.
- Input validation: validate every request body and query parameter on the server. Cap lengths. Accept only allowlisted URL schemes (`http`, `https`, `mailto`). Colours must be hex.
- Uploads: check size before reading the body. Read bodies with a streaming cap (`readBodyCapped`). Detect the real type by magic bytes. Refuse SVG and other active formats.
- Output: escape everything written into HTML. Keep the strict CSP (no inline scripts). Admin responses use `no-store` and `noindex`.
- Errors: return generic messages to clients. Log details server-side only.
- Rate limiting: add it to tracking and write endpoints when a Rate Limiting binding or WAF rule is available. Document it when it is not.
- Dependencies: run `npm audit` before releases. Review new packages.
- Never log secrets, tokens, or full user agents.

## 6. Database migration rules

- Add a new numbered file for every schema change. Never edit an applied migration.
- Migrations must be backward compatible for one release where practical: add columns as nullable or with defaults, and remove old columns in a later migration.
- Test each migration locally first (`npm run db:migrate:local`), then on `my-links-db-dev`, and only then (with approval) on production.
- Always use bound parameters for queries.
- Take a D1 export or confirm a backup before any destructive change.

## 7. API development standards

- Return JSON with consistent shapes. Use the existing `json` and `errorResponse` helpers.
- Use correct status codes: 400 validation, 401 and 403 auth, 404 not found, 413 too large, 415 wrong type, 500 unexpected.
- Admin mutations must validate the `Origin` header and must not accept GET for changes.
- Document each new endpoint in CONTEXT.md section 5.

## 8. Responsive design requirements

- Design mobile first. Test at 360 px, 768 px, 1024 px, and 1440 px wide.
- Use fluid layouts (grid, flex, `clamp()`), not fixed widths. Images use `aspect-ratio` and `object-fit` to avoid layout shift.
- Touch targets are at least 44 × 44 px.
- No horizontal scrolling at any supported width.

## 9. Accessibility standards

- Target WCAG 2.2 AA: contrast of at least 4.5:1 for text, visible focus indicators, full keyboard operation, correct landmarks and headings, and labelled form fields.
- Images need meaningful `alt` text, or `alt=""` when decorative. Embedded videos need titles.
- Respect `prefers-reduced-motion` and `prefers-color-scheme`.
- Modals use `<dialog>` with focus management.

## 10. Performance requirements

- Public page: first contentful paint under 1.5 s on a mid-range phone over 4G. Keep JavaScript for the public page small. Lazy-load the admin app.
- Images: serve resized WebP or AVIF where possible, with `loading="lazy"` below the fold and explicit dimensions.
- Video: YouTube embeds only. There are no direct video uploads. Show a lightweight thumbnail and load the YouTube player only when the visitor clicks. Never autoplay with sound.
- Cache static assets with hashed names. Keep admin responses uncached.

## 11. Testing requirements

- Every bug fix and feature gets a test where practical. Security rules always get tests.
- Before a commit: `npm run typecheck`, `npm run lint`, and `npm test` must pass.
- Before a release: also run `npm run build`, check the desktop and mobile layouts manually, and check the links and uploads.
- Keep tests running in workerd (`npm test`). Do not mock D1 or R2 with in-memory stand-ins outside the test harness.

## 12. Cloudflare deployment rules

- Development: `npm run deploy:dev` (run `npm run deploy:dev:check` first to verify without uploading), and only with the owner's approval. The script builds for dev and refuses to deploy if anything names `my-links`, `my-links-db`, `my-links-assets`, or a production hostname. Never run `wrangler deploy --env dev` after a plain `npm run build`. The Vite plugin fixes the environment at build time, so that sequence targets production. See DEVELOPMENT.md section 4. Without `ACCESS_AUD` in `env.dev`, the admin host fails closed, which is the intended safe state.
- Production: `npm run deploy` only after approval. Apply migrations with `npm run db:migrate:remote` first, then deploy.
- Never run `db:seed:remote` on production unless the owner asks, because it replaces all links.
- Check the deployment with the curl commands in the README after every deploy.

## 13. Documentation rules

- Keep CONTEXT.md, INSTRUCTIONS.md, README.md, CHANGELOG.md, and DEVELOPMENT.md current with every change that affects them.
- Do not overwrite useful existing content. Consolidate instead.
- Never put real secrets, passwords, or private keys in documentation. Use placeholders.
