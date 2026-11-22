# CONTEXT — Flicks by Miao / my-links

Living overview of the project. Update it when architecture, data, or direction changes.

## 1. Overview and purpose

A self-hosted, private link-in-bio site (a Linktree alternative) for Ry Miao (Flicks by Miao: photography and videography, Pasadena / San Gabriel Valley). Goal: one shareable public homepage that brings together professional identity, social links, photo/video work, and contact or opportunity routes. Production: `https://links.flicksbymiao.com`.

Phase 1 ("Part One") is about a stable foundation and the features in the upgrade brief. Part Two (Apple-style design, advanced galleries, analytics, AI, networking) is reserved and must not be built early, but the architecture must allow it later.

## 2. Current technology stack

- Frontend: React 19, TypeScript, Vite 8, Tailwind CSS v4, dnd-kit (sortable lists), lucide-react and simple-icons, Inter variable font.
- Backend: one Cloudflare Worker (`worker/index.ts`) that routes by hostname, serves static assets (`env.ASSETS`), and implements the API.
- Data: Cloudflare D1 (SQLite). Images: Cloudflare R2 (bound as `IMAGES`).
- Access control: Cloudflare Access on the admin hostname, plus Worker-side JWT verification.
- Tests: Vitest running inside workerd via `@cloudflare/vitest-plugin`.
- Lint/typecheck: ESLint 10, TypeScript 6.

Note: the brief mentions Cloudflare Pages. The deployed system is a single Worker with static assets. Pages is not used.

## 3. Architecture

```
Browser ──▶ Worker (wrangler.jsonc routes)
              ├─ PUBLIC host  (links.flicksbymiao.com)
              │     /               public profile (SPA, data injected into HTML)
              │     /api/profile   public read-only profile + active links
              │     /api/track/*   view / click analytics (no PII)
              │     /go/:id        click-tracked redirect to active links only
              │     /media/<key>   R2 images (only generated key patterns)
              │     /admin*        404
              └─ ADMIN host   (admin.flicksbymiao.com, behind Cloudflare Access)
                    /admin        dashboard SPA (lazy-loaded)
                    /api/admin/*  authenticated CRUD and uploads
```

Directories:

- `src/` React frontend. `src/pages` public page, `src/components` shared UI, `src/admin` dashboard, `src/lib` client utilities.
- `worker/` Worker code. `routes/public.ts`, `routes/admin.ts`, `lib/` (access, db, analytics, media, html, http).
- `shared/` types and validation used by both sides. The Worker is authoritative.
- `migrations/` D1 schema, numbered. `seed/` sample data (labelled as sample).
- `test/` Vitest suites. `public/` static files such as `theme-init.js`.

## 4. Database structure (D1)

| Table | Purpose |
|---|---|
| `profiles` | Exactly one row (`id = 1`): display name, username, bio, R2 keys for avatar and background, theme mode, colours, button style, socials (JSON). |
| `links` | Title, url, description, icon, `is_active`, `sort_order`, timestamps. |
| `analytics_events` | One row per view or click: type, link id (set null on delete), referrer hostname, country, device class, UTC timestamp. No IPs, cookies, or full user agents. |

Migrations: `migrations/0001_initial_schema.sql` is applied. Future schema changes go in `0002_*.sql`, `0003_*.sql`, and so on.

## 5. API architecture

- Public: `GET /api/profile`, `POST /api/track/view`, `POST /api/track/click`, `GET /go/:id`, `GET /media/<key>`.
- Admin (Access-protected host only): `/api/admin/me`, profile read and write, link CRUD and reorder, image upload and delete (`/api/admin/images/{avatar|background}`), analytics summary.
- Every admin write requires a same-origin `Origin` header (CSRF) and a valid Access JWT. The Worker fails closed if Access is not configured.
- All input is validated again on the server (`shared/validation.ts`). Errors are JSON with safe messages.

## 6. Storage configuration

- R2 bucket `my-links-assets` (production) and `my-links-assets-dev` (development). Bound as `IMAGES`. There are no R2 credentials and no public bucket URL. Objects are served only through the Worker.
- Keys: `avatar/<uuid>.<ext>`, `background/<uuid>.<ext>`.
- Limits: avatar ≤ 2 MB, background ≤ 5 MB. Allowed types are PNG, JPEG, WebP, and GIF, detected by magic bytes. SVG is refused.

## 7. Existing functionality (must be preserved)

- Public profile with avatar, name, @username, bio, social icons, link cards, light and dark theme toggle, custom colours, button styles, and background image.
- Link click tracking with redirect, and view counting once per browser session.
- Admin dashboard: profile editor, image uploads, link manager (add, edit, delete, show or hide, drag-and-drop ordering), appearance editor, live preview with unsaved edits, analytics (KPIs, traffic chart, top links, referrers, countries, devices).
- Security model: Access on the admin host, Worker JWT verification, email allowlist, CSRF check, strict CSP, HSTS, no-store on admin responses, URL scheme allowlist, and no open redirect.

## 8. Required functionality (Part One, from the upgrade brief)

- Homepage as the central identity page: profile photo, name and intro, biography, personal intro, professional background, areas of interest, social links, contact information.
- Professional presence: LinkedIn as an external link (no LinkedIn API), resume or CV access, experience, skills, accomplishments, testimonials, and opportunity categories (employment, collaborations, networking, freelance, business, creative partnerships).
- Social and external links: categorised, ordered, editable, removable from the admin UI.
- Photography and videography: galleries with categories, featured projects, descriptions, external media links, YouTube embeds, and direct video uploads to R2. Images are optimised and originals are preserved where practical.
- Admin area for homepage content, profile, biography, photo, social links, professional information, resume, media, featured content, projects, contact details, section visibility, and ordering. Changes previewable before publishing. Admin is never exposed to the public.
- Privacy: public homepage. Unpublished content is never public. Secrets never reach the frontend. Admin data is never exposed through public APIs.
- Security review items: auth, authz, input validation, upload validation and limits, secrets, error handling, rate limiting where appropriate.

## 9. Design direction

Modern, polished, professional. Strong typography, clear hierarchy, generous spacing, consistent components, high-quality imagery, fast load, accessibility, and mobile first. It should feel like a personal digital headquarters, not a generic link-in-bio template. Avoid clutter and unnecessary features. Part Two (premium Apple-style minimalism) is deferred.

## 10. User experience requirements

- Works on desktop, tablet, and mobile.
- Visitors can understand who the owner is within a few seconds and find work, links, and contact details without hunting.
- The owner can update the site without touching database records or source code.

## 11. Security requirements

See `INSTRUCTIONS.md` section "Security". Summary: defence in depth on admin, no secrets in the frontend, validated uploads, bounded request bodies, no unauthenticated writes, and no public exposure of admin or unpublished content.

## 12. Deployment architecture

| Environment | Worker | D1 | R2 | Hostnames |
|---|---|---|---|---|
| Production | `my-links` | `my-links-db` | `my-links-assets` | `links.flicksbymiao.com`, `admin.flicksbymiao.com` |
| Development | `my-links-dev` | `my-links-db-dev` | `my-links-assets-dev` | `dev.links.flicksbymiao.com`, `dev.admin.flicksbymiao.com` |

Development is defined as `env.dev` in `wrangler.jsonc`. Production bindings are never used by the dev environment. Production deploys require explicit owner approval.

Git: `main` is the baseline. `dev` is the working branch for this upgrade. `security-review` holds earlier hardening work.

## 13. Future roadmap

- Part One: foundation, documentation, dev environment, homepage structure, professional and social sections, media galleries and YouTube embeds, uploads, admin visual editor, preview and publish flow, tests, security review.
- Part Two (reserved): premium design system, animations, advanced multimedia portfolio, analytics and visitor insights, richer dashboard, AI features, networking features, extra customisation.
