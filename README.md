# my-links — a self-hosted link-in-bio site

A fast, private Linktree alternative running entirely on Cloudflare: a public profile page, an owner-only dashboard protected by **Cloudflare Access**, data in **D1**, images in **R2**, and privacy-friendly analytics, all served by one Worker.

| | |
|---|---|
| **Public site** | `links.example.com`: profile photo, name, @username, bio, social icons, link cards, light/dark toggle, custom colours and background |
| **Dashboard** | `admin.example.com/admin`: profile editor, image uploads, link manager (add / edit / delete / show-hide / drag-and-drop ordering), appearance editor, live preview, analytics |
| **Stack** | React 19 · TypeScript · Vite · Tailwind CSS v4 · Cloudflare Workers · D1 · R2 · Access |

---

## What's real and what's sample data

Every feature is backed by the Worker. Nothing is mocked in the shipped app.

- **Sample data** is in `seed/seed.sql` and is labelled as such: the "Alex Rivera" profile and six example links (one hidden). You load it on purpose with `npm run db:seed:local`. Edit or delete it from the dashboard.
- **The migration** (`migrations/0001_initial_schema.sql`) only creates a placeholder profile ("Your Name") so the page renders before you customise it.
- **Analytics are never seeded.** Every number in the dashboard is a real view or click recorded by the Worker.
- **Tests** use a throwaway in-memory D1/R2 and a locally generated signing key in place of Cloudflare Access's public keys (see [Testing](#testing)).

---

## Project structure

```
├── src/                      React frontend (one SPA, code-split)
│   ├── pages/PublicProfile   public page (reads server-injected data → instant paint)
│   ├── components/           ProfileView, LinkCard, Avatar, SocialIcons, ThemeToggle, icons
│   ├── admin/                dashboard (lazy-loaded; never downloaded by visitors)
│   │   ├── AdminApp          layout, auth check, draft state, unsaved-changes bar
│   │   ├── ProfileEditor     name / username / bio / socials / photo
│   │   ├── LinkManager       dnd-kit sortable list + LinkEditor modal
│   │   ├── AppearanceEditor  theme, accent + background colours, link style, background image
│   │   ├── LivePreview       real ProfileView rendered with unsaved edits, light/dark
│   │   ├── Analytics         KPIs, traffic chart (+ table view), top links, referrers…
│   │   └── ui.tsx            Button, Field, Input, Switch, Modal (<dialog>), toasts…
│   └── lib/                  api client, router, theme + colour helpers
├── worker/                   Cloudflare Worker (API + hostname routing + asset serving)
│   ├── index.ts              routes by hostname, enforces Access, security headers
│   ├── routes/public.ts      /api/profile, /api/track/view, /go/:id, /media/*
│   ├── routes/admin.ts       /api/admin/* (profile, links, images, homepage, analytics)
│   └── lib/                  access (JWT verification), db, homepage (draft/publish), analytics, media (R2), html, http
├── shared/                   types + validation used by both sides (Worker is authoritative)
├── migrations/               D1 schema
├── seed/seed.sql             sample profile + links
├── public/theme-init.js      pre-paint theme script (external file → strict CSP works)
├── test/                     Vitest suites running inside workerd
└── wrangler.jsonc            bindings, hostnames, Access settings
```

---

> **Start here:** project overview in [CONTEXT.md](CONTEXT.md), development rules in [INSTRUCTIONS.md](INSTRUCTIONS.md), the dev environment in [DEVELOPMENT.md](DEVELOPMENT.md), and history in [CHANGELOG.md](CHANGELOG.md).

## Local development

**Requires:** Node.js 20+ (tested on 24) and npm.

```bash
npm install
cp .dev.vars.example .dev.vars    # enables the local-only auth bypass (see Security)
npm run setup                     # apply D1 migrations + load sample data (local)
npm run dev                       # http://localhost:5173
```

- Public page: <http://localhost:5173/>
- Dashboard: <http://localhost:5173/admin> (an amber badge shows "Local dev · auth bypassed")

`npm run dev` uses the Cloudflare Vite plugin, so your Worker runs in the real `workerd` runtime with local D1 and R2 (stored under `.wrangler/state`) and hot reload for both the frontend and the Worker.

| Script | What it does |
|---|---|
| `npm run dev` | Vite + Worker dev server |
| `npm run build` | Typecheck + production build (`dist/`) |
| `npm run preview` | Build and serve the production bundle locally |
| `npm test` | Run the test suite |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm run db:migrate:local` / `:remote` | Apply D1 migrations |
| `npm run db:seed:local` / `:remote` | Load the sample data (**replaces all links**) |
| `npm run deploy` | Build and deploy to **production** (owner approval required) |
| `npm run deploy:dev:check` | Build for dev and verify every target is dev-only (uploads nothing) |
| `npm run deploy:dev` | The same checks, then deploy to the dev Worker `my-links-dev` |
| `npm run cf-typegen` | Regenerate `worker-configuration.d.ts` after editing `wrangler.jsonc` |

---

## Database (D1)

Schema: `migrations/0001_initial_schema.sql`, `0002_add_homepage_sections.sql`, `0003_add_link_categories.sql`, `0004_add_homepage_open_to.sql`, `0005_add_story_and_section_settings.sql`

| Table | Purpose |
|---|---|
| `profiles` | Exactly one row (`id = 1`): name, username, bio, R2 image keys, theme mode, colours, link style, socials (JSON) |
| `links` | title, url, description, icon, `category`, `is_active`, `sort_order`, timestamps |
| `analytics_events` | one row per view or click: `type`, `link_id`, referrer hostname, country, device class, UTC timestamp |
| `homepage_intro`, `homepage_contact`, `homepage_open_to`, `homepage_story` | Headline and About, Let's work! details, the one-sentence line, and My story. One `draft` and one `published` row each |
| `homepage_skills`, `homepage_section_settings` | Ordered rows tagged `draft` or `published` |
| `homepage_experience`, `homepage_opportunities`, `homepage_sections` | Retired; kept so no data is deleted |

**Homepage draft and publish.** The dashboard's Homepage tab saves to the `draft` rows. **Publish** copies every draft table to its `published` copy in one atomic batch. The public site only ever reads `published` rows, and hidden sections are removed before data leaves the Worker. Migration 0002 inserts placeholder content as drafts only, so applying it changes nothing publicly.

To add a schema change, create the next numbered file (e.g. `migrations/0004_<name>.sql`) and run `npm run db:migrate:local` (then `:remote` when you deploy). All queries use bound parameters.

Deleting a link keeps its past clicks in your all-time totals (`ON DELETE SET NULL`).

---

## Image storage (R2)

- Profile photos (≤ 2 MB) and background images (≤ 5 MB) are uploaded through `POST /api/admin/images/{avatar|background}` and stored as `avatar/<uuid>.<ext>` / `background/<uuid>.<ext>`.
- **Validation happens on the server:** the request size is checked before the body is read, and the real type is detected from the file's magic bytes, so the browser's declared type is ignored. Only PNG, JPEG, WebP and GIF are accepted. SVG is refused because it can contain script.
- Replacing or removing an image deletes the old object.
- Objects live in the `my-links-assets` bucket, bound to the Worker as `IMAGES` (see `wrangler.jsonc`). The frontend never talks to R2 directly.
- Images are served by the Worker at `/media/<key>` with immutable caching, `nosniff` and a sandboxing CSP. Only keys matching the generated pattern can be fetched, so other objects in the bucket can't be read through this route.

---

## Security

This is a single-owner site. The model is: **Cloudflare Access guards the admin hostname, and the Worker verifies every admin request itself.**

1. **Hostname separation.** The Worker routes by `Host`. On `PUBLIC_HOSTNAME`, every `/admin*` and `/api/admin*` path returns 404. On `ADMIN_HOSTNAME`, every request (pages, JS/CSS assets, API) requires authentication. `workers_dev` and preview URLs are disabled so the Worker can't be reached on an unprotected hostname.
2. **Access JWT verification (defence in depth).** Every admin request must carry `Cf-Access-Jwt-Assertion`. The Worker checks the RS256 signature against your team's public keys (cached, and refreshed when keys rotate), the audience (`ACCESS_AUD`), the issuer (`https://ACCESS_TEAM_DOMAIN`), and expiry/not-before. It **fails closed**: if Access isn't configured, admin requests get a 500 error and are never let through.
3. **Optional email allowlist.** `ADMIN_EMAILS` adds a second check on top of the Access policy.
4. **CSRF.** State-changing admin requests must send an `Origin` that matches the admin origin.
5. **Validation.** All input is re-validated on the server (`shared/validation.ts`). URLs must be `http(s)` or `mailto:`, so `javascript:` and `data:` links are rejected. Field lengths are capped and colours must be hex values.
6. **No open redirect.** `/go/:id` redirects only to active links stored in D1.
7. **Headers.** Strict CSP (`script-src 'self'`, no inline scripts; profile data is embedded as non-executable JSON), HSTS, `X-Frame-Options: DENY`, `nosniff`, a strict referrer policy and a permissions policy. Admin responses are `no-store` and `noindex`.
8. **No secrets in the frontend.** The bundle contains no credentials. The Access AUD and team domain aren't secret either: they only identify which tokens to accept.
9. **Local bypass.** `DEV_AUTH_BYPASS="true"` (in `.dev.vars`) is honoured **only** when the request hostname is `localhost`/`127.0.0.1`. `.dev.vars` is git-ignored and is not deployed as Worker configuration (the Vite build copies it into `dist/` for `vite preview` only). Even if it were set in production, the hostname check makes it inert, and a test proves this.

**Privacy.** Analytics store no IP addresses, cookies or full user agents: only the referrer hostname, the country code from Cloudflare, and a device class. Known bots and prefetch requests are skipped. Views are counted once per browser session.

---

## Deployment

You need a Cloudflare account and a domain on Cloudflare (for the two custom hostnames).

```bash
npx wrangler login
```

**1. Create the resources.**

```bash
npx wrangler d1 create my-links-db       # copy the database_id it prints (skip if already created)
npx wrangler r2 bucket create my-links-assets   # skip if already created
```

**2. Edit `wrangler.jsonc`.**

- `d1_databases[0].database_id`: the id from above
- `routes`: your two hostnames, e.g. `links.yourdomain.com` and `admin.yourdomain.com`
- `vars.PUBLIC_HOSTNAME` / `vars.ADMIN_HOSTNAME`: the same two hostnames
- `vars.ACCESS_TEAM_DOMAIN` / `vars.ACCESS_AUD`: from step 3
- `vars.ADMIN_EMAILS`: optional, e.g. `"you@yourdomain.com"`

Then run `npm run cf-typegen`.

**3. Protect the admin hostname with Cloudflare Access.** In the [Zero Trust dashboard](https://one.dash.cloudflare.com/):

1. **Access → Applications → Add an application → Self-hosted.**
2. Application domain: your admin hostname, e.g. `admin.yourdomain.com`, with an empty path so the whole host is covered.
3. Add a policy, **Action: Allow**, with **Include → Emails →** your email address. Pick a login method (One-time PIN works out of the box).
4. Save. Open the application's **Overview** and copy the **Application Audience (AUD) Tag** into `ACCESS_AUD`.
5. Your team domain (`<team>.cloudflareaccess.com`) is under **Settings → Custom Pages** / **Team domain**. Put it in `ACCESS_TEAM_DOMAIN`.

Do **not** add an Access application for the public hostname.

**4. Migrate and deploy.**

```bash
npm run db:migrate:remote
npm run db:seed:remote     # optional: only if you want the sample content live
npm run deploy
```

Visit `https://admin.yourdomain.com`. Access asks you to sign in, then you're redirected to the dashboard. Your public page is at `https://links.yourdomain.com`.

**Checking it:** `curl -i https://admin.yourdomain.com/api/admin/me` should be stopped by Access (a redirect to its login page). `curl -i https://links.yourdomain.com/admin` should return 404.

---

## Testing

```bash
npm test
```

The tests run inside `workerd` through `@cloudflare/vitest-plugin`, using the real Worker, the real D1 migrations and a real R2 binding (isolated per test file). The only stand-in is Cloudflare Access's public-key endpoint, which serves a locally generated RSA key so the Worker can verify real signed JWTs. They cover:

- **Access enforcement:** missing, forged, expired and wrong-audience tokens; the email allowlist; admin pages and assets as well as APIs; the dev bypass ignored on real hostnames; admin paths returning 404 on the public host; CSRF.
- **Profile and links:** CRUD, validation, ordering, categories, and only active links appearing publicly.
- **Homepage draft/publish:** placeholder drafts never public, per-section server validation, drafts staying private until publish, hidden sections removed from public data, reset to live, and published tables matching the draft exactly.
- **HTML injection:** escaping of embedded data and meta tags, and the CSP.
- **Analytics:** recording, bot filtering, the no-open-redirect rule, and the summary maths.
- **R2:** upload, serving, cleanup of replaced images, and rejecting disguised, oversized or unknown files.
- **Shared validation:** unit tests.

---

## Customising

- **Social platforms / link icons:** `src/components/icons.tsx`
- **Colour presets:** `src/admin/AppearanceEditor.tsx`
- **Size limits:** `shared/validation.ts` (`LIMITS`, `IMAGE_RULES`)
- **Footer branding:** the `<footer>` in `src/components/ProfileView.tsx`

## Known limitations

- The tracking endpoints are unauthenticated by nature. Bots are filtered by user agent, but there's no rate limiting, so someone determined could inflate counts. If that matters, add a [Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) or a WAF rule on `/api/track/*` and `/go/*`.
- Raw events are kept indefinitely. For very high traffic, add a Cron Trigger that rolls old events up into daily totals.
