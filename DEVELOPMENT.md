# Development setup guide

This guide sets up a local copy of the site and the isolated `dev` Cloudflare environment. Production is never touched by these steps.

## Prerequisites

- Node.js 20 or newer (tested on 24) and npm.
- Git.
- A Cloudflare account with the `flicksbymiao.com` zone, and `wrangler login` run once on your machine.

## 1. Clone and install

```bash
git clone <repo-url> my-links
cd my-links
git checkout dev
npm install
```

On Windows, `npm install` may leave platform-specific binaries (for example `rolldown`) that break on Linux, and the reverse. If a native module error appears, delete `node_modules` and run `npm install` on the machine you use.

## 2. Local environment

```bash
cp .env.example .dev.vars     # or .dev.vars.example, which enables the local auth bypass
npm run setup                 # apply migrations and load sample data into the LOCAL D1
npm run dev                   # http://localhost:5173
```

- Public page: http://localhost:5173/
- Dashboard: http://localhost:5173/admin (shows "Local dev · auth bypassed").
- Local D1 and R2 live in `.wrangler/state`. They are git-ignored.

## 3. Checks before committing

```bash
npm run typecheck
npm run lint
npm test
```

## 4. Dev Cloudflare environment

Resources (already created):

| Resource | Name | ID or notes |
|---|---|---|
| D1 | `my-links-db-dev` | `980aacda-351e-4828-b370-d9b084b50734`. Migrations 0001–0007 applied (tracked in `d1_migrations`). |
| R2 | `my-links-assets-dev` | Standard storage, ENAM region. |
| Worker | `my-links-dev` | Deployed. |
| Hostnames | `dev.links.flicksbymiao.com`, `dev.admin.flicksbymiao.com` | Custom domains, attached on deploy. |
| Access | "my-links dev admin" on `dev.admin.flicksbymiao.com` | AUD tag set in `env.dev.vars.ACCESS_AUD`. If `ACCESS_AUD` is missing, the dev admin host fails closed by design. |

### Deploying the dev Worker

The build uses the Cloudflare Vite plugin. **The plugin picks the environment when you build, not when you deploy.** `npm run build` writes `dist/my_links/wrangler.json` and `.wrangler/deploy/config.json`, and `wrangler deploy` reads that generated config. The `--env` flag on `wrangler deploy` does not switch it. A plain build produces the **production** config, so `npm run build` followed by `npx wrangler deploy --env dev` would fail or deploy to production. Do not use that sequence.

Use the guarded scripts (they work the same in PowerShell, Git Bash, macOS, and Linux):

```bash
npm run deploy:dev:check   # build for dev, verify, dry run. Uploads nothing.
npm run deploy:dev         # the same checks, then deploys my-links-dev
```

`scripts/deploy-dev.mjs` builds with `CLOUDFLARE_ENV=dev` and then checks three things. It stops before uploading if any check fails:

1. The generated config names Worker `my-links-dev`, D1 `my-links-db-dev`, R2 `my-links-assets-dev`, and only the two `dev.` hostnames.
2. Neither the generated config nor the dry-run output mentions `my-links-db`, `my-links-assets`, `links.flicksbymiao.com`, or `admin.flicksbymiao.com` without the `dev` prefix or suffix.
3. After deploying, the output confirms `Uploaded my-links-dev`.

Every dev deploy still needs the owner's approval first.

Manual equivalent, if you ever need it: `CLOUDFLARE_ENV=dev npm run build`, then `npx wrangler deploy --dry-run` (read the binding list), then `npx wrangler deploy`. Do not use `wrangler deploy -c wrangler.jsonc`. It bypasses the Vite build and fails with "The `assets` property … is missing the required `directory` property."

Check it afterwards:

- `curl -i https://dev.links.flicksbymiao.com/` returns 200.
- `curl -i https://dev.links.flicksbymiao.com/admin` returns 404.
- `curl -i https://dev.admin.flicksbymiao.com/api/admin/me` returns a 302 or 403 with a `Location` header pointing to the Access login.

The first time a custom domain is attached, your machine may have cached a "not found" DNS answer. Run `ipconfig /flushdns` on Windows, or wait a few minutes.

Remote D1 commands for dev:

```bash
npx wrangler d1 migrations apply DB --remote --env dev
npx wrangler d1 execute DB --remote --env dev --file=seed/seed.sql   # sample data, dev only
```

Never run these with `--env` omitted when you mean dev. Omitting `--env` targets production.

## 5. Production (approval required)

A copy of the live site from before Part One exists: git tag `live-before-part-one` and `backups/live-before-part-one-2026-11-22/` (local only, see its README for how to look at it or roll back).

Production deploys are not part of routine development. Only after explicit approval:

```bash
npm run db:migrate:remote
npm run deploy
```

`npm run deploy` rebuilds without `CLOUDFLARE_ENV`, so it always produces and deploys the production config. Make sure `CLOUDFLARE_ENV` is not set in your shell when you run it.

## 6. Line endings (Windows)

The repository uses LF line endings. A Windows checkout with `core.autocrlf` off shows every file as modified. These changes are whitespace only. Check with `git diff --ignore-cr-at-eol`. Stage files explicitly. Do not commit whole-file line-ending changes.

## 7. Troubleshooting

- **Dashboard shows "Access not configured" or a 500 on admin:** `ACCESS_AUD` is missing or still `REPLACE_ME`. This is intentional fail-closed behaviour.
- **Local dashboard asks to sign in:** the `.dev.vars` file is missing `DEV_AUTH_BYPASS="true"`, or you are not on `localhost`.
- **Migrations out of sync:** check `d1_migrations` in the local state, or reset local state by deleting `.wrangler/state` (local only, never remote).
