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
| `homepage_intro` | Headline (shown under the name) and a short About text. One row per `state`. Older columns (intro, background, interests) are unused. |
| `homepage_contact` | Email, location, portfolio URL, `portfolio_coming_soon`. One row per `state`. Older columns (phone, LinkedIn, resume) are unused. |
| `homepage_open_to` | The one-sentence "what I'm up for" line (migration 0004). One row per `state`. |
| `homepage_skills` | Ordered skill tags, each tagged with `state`. |
| `homepage_sections` | Visibility and order of the sections (`intro`, `skills`, `opportunities` = the one-sentence line, `contact`, `testimonials`) per `state`. |
| `homepage_experience`, `homepage_opportunities` | **Retired** (pass 1b). Kept so no data is deleted; not read or written. |

`links` also has `category` (migration 0003): an optional group heading on the public page.

**Draft and publish.** Every `homepage_*` table stores a `'draft'` and a `'published'` copy, distinguished by the `state` column. The admin editor writes drafts. Publishing copies every draft table over its published copy in one D1 batch (`worker/lib/homepage.ts`). Public routes read only published rows, and `toPublicHomepage()` (`shared/homepage.ts`) removes hidden sections and the placeholder portfolio URL before anything leaves the Worker. Testimonials have no table yet: the section is a placeholder slot.

Migrations: `0001_initial_schema.sql`, `0002_add_homepage_sections.sql` (adds the homepage tables and placeholder **drafts only**, so applying it publishes nothing), `0003_add_link_categories.sql` (adds `links.category`), and `0004_add_homepage_open_to.sql` (adds the one-sentence table and refreshes untouched placeholder drafts). 0001–0004 are applied locally and to `my-links-db-dev` (2026-11-21). **Not applied to production** (`my-links-db`). Apply them there before any production deploy of this code, or the public page will fail to load. Future changes go in `0005_*.sql` and up.

## 5. API architecture

- Public: `GET /api/profile`, `POST /api/track/view`, `POST /api/track/click`, `GET /go/:id`, `GET /media/<key>`.
- Admin (Access-protected host only): `/api/admin/me`, profile read and write, link CRUD and reorder, image upload and delete (`/api/admin/images/{avatar|background}`), analytics summary.
- Homepage (admin): `GET /api/admin/homepage` returns the draft, the published copy, `publishedAt`, and `hasUnpublishedChanges`. `PUT /api/admin/homepage/{intro|contact|skills|experience|opportunities|sections}` validates and saves one section to the draft. `POST /api/admin/homepage/publish` makes the draft live. `POST /api/admin/homepage/discard` resets the draft to the live version. All return the same state shape.
- `GET /api/profile` and the HTML-embedded data include `homepage`: the published, visible sections only, or `null` before the first publish.
- Every admin write requires a same-origin `Origin` header (CSRF) and a valid Access JWT. The Worker fails closed if Access is not configured.
- All input is validated again on the server (`shared/validation.ts`). Errors are JSON with safe messages.

## 6. Storage configuration

- R2 bucket `my-links-assets` (production) and `my-links-assets-dev` (development). Bound as `IMAGES`. There are no R2 credentials and no public bucket URL. Objects are served only through the Worker.
- Keys: `avatar/<uuid>.<ext>`, `background/<uuid>.<ext>`.
- Limits: avatar ≤ 2 MB, background ≤ 5 MB. Allowed types are PNG, JPEG, WebP, and GIF, detected by magic bytes. SVG is refused.

## 7. Existing functionality (must be preserved)

- Public profile with avatar, name, @username, bio, social icons, link cards, light and dark theme toggle, custom colours, button styles, and background image.
- Link click tracking with redirect, and view counting once per browser session.
- Admin dashboard: profile editor, image uploads, link manager (add, edit, delete, show or hide, drag-and-drop ordering, categories), appearance editor, live preview with unsaved edits, analytics (KPIs, traffic chart, top links, referrers, countries, devices).
- Homepage sections (Part One, pass 1b): a headline under the name, About (a few sentences), Skills (tags), one sentence about what the owner is up for, Say hi (email, location, portfolio "coming soon"), and a Testimonials placeholder. The owner decided the page must not read like LinkedIn: no experience timeline, no opportunity cards, and LinkedIn stays a social icon only. Plain headings, no all-caps labels. Edited in the dashboard **Homepage** tab with save-draft, preview, publish, and reset-to-live. Placeholder content is in place until the owner supplies real copy.
- Security model: Access on the admin host, Worker JWT verification, email allowlist, CSRF check, strict CSP, HSTS, no-store on admin responses, URL scheme allowlist, and no open redirect.

## 8. Required functionality (Part One, from the upgrade brief)

- Homepage as the central identity page: profile photo, name and intro, biography, personal intro, professional background, areas of interest, social links, contact information.
- Professional presence, **personal rather than LinkedIn-style** (owner decision, pass 1b): LinkedIn only as a social icon (no API, no duplicate button), skills as tags, one sentence about the opportunities the owner is up for, and a testimonials placeholder slot (no testimonials management). No work-history timeline or opportunity cards. A resume link was dropped from the page for now.
- Social and external links: categorised, ordered, editable, removable from the admin UI.
- Photography and videography: **the portfolio will be a separate site.** This site only links to it (a "Portfolio" link marked "coming soon" until it exists). No galleries are built here.
- Video: **YouTube only.** Videos are embedded and play inside the site, loading the player only when the visitor interacts (no player on page load). **No direct video uploads.** Not built yet; planned for a later pass. It will need a `frame-src` CSP entry for the YouTube embed domain.
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

- Part One: foundation, documentation, dev environment, homepage structure, professional and social sections, YouTube embeds (click to load, no video uploads), admin visual editor, preview and publish flow, tests, security review. Done in pass 1: dev deploy guard, homepage sections with draft/publish and the Homepage editor, link categories, design tokens. Pass 1b: simplified the homepage so it doesn't read like LinkedIn. The portfolio and its galleries will be a separate site.
- Part Two (reserved): premium design system, animations, advanced multimedia portfolio, analytics and visitor insights, richer dashboard, AI features, networking features, extra customisation.
