# Changelog

All notable changes. Newest first. Format loosely follows Keep a Changelog.

## [Unreleased] — Part One (development)

### Added (pass 4: clients, share preview, QR)
- "Worked with" client strip (migration `0008`): a row of client logos under your links on Home. In the Homepage tab you can add clients, rename them, upload or replace a logo, switch a client to name only, reorder, and remove. Names are the logos' alt text, and clients without a logo show their name. Logos are stored in R2 under `client-logo/` with the same server checks as photos (real type from the file's bytes, size limit), limited to PNG, JPEG and WebP up to 1 MB; no GIF or SVG. Unused logos are cleaned up automatically. Starts hidden, with five placeholder clients in the draft (four placeholder logos, one name only) until you add real ones.
- Share preview: pasting your link into a text, Instagram, Slack and similar shows your photo, name, and a short tagline (your published line under the name, or your bio). Adds `og:site_name`, `og:image:alt`, `profile:username`, and full Twitter card tags. Preview URLs and the image always use the real public address, and only published content is used.
- QR code: the Share button now opens a small pop-up with a QR code for your page, Copy link, and your phone's share sheet. The code is generated in the visitor's browser (no outside service) by `lean-qr` (MIT, no dependencies, 2.1 kB gzipped), and the pop-up loads only when someone taps Share, so the page itself doesn't get bigger.

### Changed (motion polish)
- Page tabs: the highlight springs to the chosen tab and stretches slightly while it moves.
- Story pop-up: grows out of the location you tapped and shrinks back into it when closed (Close, Esc, or tapping outside), instead of closing instantly.
- Tap feedback that also works on phones (including iPhone): link cards, social icons, skill chips, the Work contact rows, and Read more press in and spring back.
- My story: Read more opens to the story's real height with a soft spring while the bottom fade dissolves, and closes right away instead of after a delay. The button only appears when the story is actually cut off at the current screen width; otherwise the whole story shows.
- Uses the `motion` package (small LazyMotion + `m` setup). Reduced-motion visitors still get no movement; the pop-up just fades. Public page JavaScript is about 35 kB larger (gzip).
- Fixed: on computers, opening About briefly showed the whole story before it collapsed to Read more. The story is now measured before it is drawn.
- Story flash fix deployed: dev `my-links-dev` (version `3da52357`), then production `my-links` (version `aa717845`, previous `7089786e`, `main` at `8a61481`, no migration). Verified on live at desktop width: About opens collapsed from the first frame with zero layout shift; pages 200, admin path 404 on the public host, admin host redirects to Access, photo served, CSP and HSTS present, no console errors.
- Dev deploy: motion polish to `my-links-dev` (version `62e9895c`, no migration). Checked in the browser on the real CSP: no violations or console errors.
- **Production:** fast-forwarded `main` to `dev` (`9536633`) and deployed `my-links` (version `7089786e`, previous `4786094f`, no migration). Verified: public pages 200, admin path 404 on the public host, admin host redirects to Access, photo served, CSP and HSTS present, no console errors.

### Added (Part One finish)
- YouTube videos (migration `0007`): a "Videos" section on the Work page. Paste a YouTube link in the Homepage editor, give it a title, reorder or remove. Visitors see a thumbnail; the player (privacy-enhanced youtube-nocookie.com) loads and plays only when they tap. Up to 12 videos. Starts hidden until turned on in Sections.
- Security: CSP now allows `frame-src https://www.youtube-nocookie.com` and thumbnails from `https://i.ytimg.com`, nothing else.

### Changed (Part One finish)
- Background photos keep their real colours: when a background photo is set, the accent-coloured glows are skipped, the colour wash is lighter (60% instead of 80%), and the edge shading is neutral instead of warm.

### Added (pass 3b)
- Any size photo can be uploaded: the dashboard resizes profile photos (800 px) and backgrounds (2400 px) in the browser and saves them as WebP before upload. Pages load faster, and the 2 MB / 5 MB server limits stay as a safety net. GIFs are not resized.
- Position your profile photo: after choosing a photo, a "Position your photo" window lets you drag it and zoom so the right part sits in the circle (also works with arrow keys and +/-). "Adjust position" reopens it on the current photo. Saves an 800 px square; no database change. GIFs skip this step so animation is kept.
- Dev deploy: profile photo positioning (version `9fab946e`, no migration).
- **Production: Part One is live.** After a security review of `live-before-part-one..dev` (no findings) and a fresh read-only export, applied migrations 0002–0007 to `my-links-db` (confirmed ID `67276e88…`; row counts unchanged), fast-forwarded `main` to `dev`, and deployed `my-links` (version `4786094f`, previous `8474bd3c`). Verified: public pages 200, admin paths 404 on the public host, admin host redirects to Access, photos served, CSP and HSTS present. Homepage sections are unpublished on production until the owner publishes them.
- Backed up the live site before Part One (read-only): git tag `live-before-part-one` on `df40a83` (verified to match live Worker version `8474bd3c`), plus a local-only export of `my-links-db` and the live photos in `backups/` (git-ignored). Production was not modified.
- Applied migration 0007 to `my-links-db-dev` (confirmed ID `980aacda…` first) and deployed YouTube videos and the background colour fix to `my-links-dev` (version `fe04254d`). Production was not modified.
- Film grain setting in Appearance (migration `0006`): Moving (default, the current look), Still (texture without flicker), or Off. The story pop-up follows the same setting.

### Changed (pass 3: professional and cozy)
- Warm serif for the name and headings (system serifs, no download) with Inter for body text. Body text is now 16px with a comfortable line length. Softer corners and more space between sections.
- "Let's work!" uses an italic accent, and the one-sentence line is set in italic serif.
- A soft film vignette joins the grain.
- Appearance: a one-click "Cozy film" colour preset (terracotta, cream, espresso) and warm swatches.
- Accessibility: accent-coloured text and icons are automatically adjusted to readable contrast in both themes, text on the accent picks black or white by contrast, buttons show a pointer cursor, and focus rings use the readable accent.

### Added (pass 2)
- Separate pages: Home (`/`), About (`/about`), and Work (`/work`), with an animated tab bar. Each page is served with embedded data, its own title, and its own canonical URL.
- Wider layout on computers: two columns with your photo, name, and icons pinned on the left. Phones keep one column. Layout follows the page's own width (container queries), so the dashboard preview shows the phone version.
- "My story" (migration `0005`): a story about where you grew up, on the About page with a Read more expander, and in a pop-up card when visitors tap your location. Its title is fully editable and is used everywhere visitors see it: the About heading, the tag next to your location, and the pop-up.
- Lively motion and texture: scroll-in reveals, page transitions, a floating avatar with a turning halo, drifting background light, word-by-word lines, a shine sweep on link cards, springy hover and tap effects, and animated film grain. Reduced-motion visitors get none of it.

### Changed
- "Say hi" is now "Let's work!". Sections are grouped by page in the dashboard; the up/down buttons move them within their page.
- Section order now lives in `homepage_section_settings` (migration `0005`), copied from `homepage_sections`, which is kept unused.
- Homepage made personal rather than LinkedIn-style (migration `0004`): removed the Experience section, replaced the six "Open to" cards with one sentence, and trimmed Say hi to email, location, and the portfolio badge (LinkedIn stays in the social icons). About is now a few sentences. Plain headings instead of all-caps labels, including link category headings. Friendlier placeholder copy, applied only to drafts still holding the original placeholder. Retired tables are kept, not deleted. Route `PUT /api/admin/homepage/open-to` replaces `experience` and `opportunities`.

### Added
- Homepage sections with draft / publish (migration `0002`): intro and about, contact and professional links (LinkedIn, resume link, portfolio "coming soon"), skills, experience, "open to" opportunity categories, a testimonials placeholder slot, and per-section visibility and order. Placeholder content ships as drafts only, so nothing changes publicly until you press Publish. API: `GET /api/admin/homepage`, `PUT /api/admin/homepage/{intro|contact|skills|experience|opportunities|sections}`, `POST /api/admin/homepage/publish`, `POST /api/admin/homepage/discard`. The public API returns only published, visible sections.
- Public homepage sections below the links: About me, Experience, Skills, Open to, Contact (email, phone, location, LinkedIn, resume, and portfolio with a "Coming soon" badge), and a Testimonials placeholder. A headline shows under your name. Links with a category are grouped under a heading.
- Dashboard **Homepage** tab: edit every section, show or hide and reorder sections, save drafts, preview unsaved edits in the live preview, publish, or reset the draft to the live version.
- Design tokens for the public page (`src/index.css`, `--p-*`): width, radii, spacing, and type sizes. New components use them; colours still come from the owner's palette.
- Link categories (migration `0003`): an optional category per link, editable in the link editor, with suggestions from existing categories.
- Guarded dev deploy: `npm run deploy:dev:check` and `npm run deploy:dev` (`scripts/deploy-dev.mjs`). They build for dev and stop before uploading if the config or dry run names any production resource or hostname.
- Development environment in `wrangler.jsonc` (`env.dev`): separate Worker (`my-links-dev`), D1 (`my-links-db-dev`), R2 (`my-links-assets-dev`), and dev hostnames.
- Project documentation: `CONTEXT.md`, `INSTRUCTIONS.md`, `DEVELOPMENT.md`, `.env.example`, `CHANGELOG.md`.

### Changed
- Request body size limits now enforce while streaming (`readBodyCapped`), so missing or false `Content-Length` headers cannot force buffering. Applies to JSON bodies and image uploads.
- `ADMIN_EMAILS` set to the owner's address as a defence-in-depth allowlist.

### Fixed
- Documented dev deploy command corrected. `npx wrangler deploy --env dev` after a plain build used the production config generated by the Vite plugin. Dev deploys now build with `CLOUDFLARE_ENV=dev` and check a `--dry-run` before deploying (DEVELOPMENT.md, INSTRUCTIONS.md, `wrangler.jsonc` comment).

### Infrastructure
- Deployed in-browser photo resizing to `my-links-dev` (version `06dbb21c`). No migrations. Production was not modified.
- Applied migration 0006 to `my-links-db-dev` and deployed the film grain setting to `my-links-dev` (version `34123a9b`). Production was not modified.
- Deployed pass 3 (professional and cozy) to `my-links-dev` (version `d8625d1e`). No migrations. Production was not modified.
- Applied migration 0005 to `my-links-db-dev` and deployed pass 2 to `my-links-dev` (version `0c7b0a32`). Production was not modified.
- Applied migration 0004 to `my-links-db-dev` and deployed pass 1b to `my-links-dev` (version `4d795e35`). Production was not modified.
- Applied migrations 0001–0003 to `my-links-db-dev` and deployed pass 1 to `my-links-dev` with `npm run deploy:dev` (version `47330cd2`). Homepage sections are unpublished placeholder drafts there. Production was not modified.
- Deployed the dev Worker `my-links-dev` to `dev.links.flicksbymiao.com` and `dev.admin.flicksbymiao.com` (Access-protected). Production was not modified.
- Created D1 `my-links-db-dev` and R2 `my-links-assets-dev`. Applied migration 0001 to the dev database. Production resources were not modified.

## [0.1.0] — Baseline (pre-upgrade)

- Link-in-bio site: public profile, owner dashboard behind Cloudflare Access, D1 storage, R2 images, click and view analytics.
