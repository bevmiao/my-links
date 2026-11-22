#!/usr/bin/env node
/**
 * Guarded deploy for the DEVELOPMENT environment only (Worker `my-links-dev`).
 *
 *   npm run deploy:dev:check   build for dev, verify every target, dry run. Uploads nothing.
 *   npm run deploy:dev         the same checks, then deploy to my-links-dev.
 *
 * Why this exists: the Cloudflare Vite plugin fixes the target environment at BUILD time and
 * `wrangler deploy` reads the generated config (dist/my_links/wrangler.json). A plain
 * `npm run build` produces the PRODUCTION config, and `--env dev` on deploy does not change it.
 * This script builds with CLOUDFLARE_ENV=dev and refuses to continue if anything it is about to
 * deploy names a production resource. It never deploys production.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const checkOnly = process.argv.includes('--check')
const env = { ...process.env, CLOUDFLARE_ENV: 'dev' }

const EXPECTED = {
  worker: 'my-links-dev',
  d1: 'my-links-db-dev',
  r2: 'my-links-assets-dev',
  hosts: ['dev.links.flicksbymiao.com', 'dev.admin.flicksbymiao.com'],
}

/** Production names. Any match anywhere in the generated config or dry-run output stops the deploy. */
const FORBIDDEN = [
  { label: 'production D1 (my-links-db)', re: /\bmy-links-db\b(?!-dev)/ },
  { label: 'production R2 (my-links-assets)', re: /\bmy-links-assets\b(?!-dev)/ },
  { label: 'production hostname links.flicksbymiao.com', re: /(?<!dev\.)\blinks\.flicksbymiao\.com/ },
  { label: 'production hostname admin.flicksbymiao.com', re: /(?<!dev\.)\badmin\.flicksbymiao\.com/ },
]

function fail(message) {
  console.error(`\n✖ STOPPED: ${message}\nNothing was deployed.`)
  process.exit(1)
}

const stripAnsi = (s) => s.replace(/\u001b\[[0-9;]*m/g, '')

function run(cmd, { capture = false } = {}) {
  console.log(`\n> ${cmd}`)
  const r = spawnSync(cmd, {
    shell: true,
    env,
    encoding: 'utf8',
    stdio: capture ? ['inherit', 'pipe', 'pipe'] : 'inherit',
  })
  const out = capture ? stripAnsi(`${r.stdout ?? ''}${r.stderr ?? ''}`) : ''
  if (capture) process.stdout.write(out)
  if (r.status !== 0) fail(`"${cmd}" exited with code ${r.status}.`)
  return out
}

function assertNoProduction(text, where) {
  for (const { label, re } of FORBIDDEN) {
    if (re.test(text)) fail(`${where} mentions the ${label}.`)
  }
}

// 1. Build for dev.
run('npm run build')

// 2. Check the config wrangler will actually deploy.
const redirect = JSON.parse(readFileSync('.wrangler/deploy/config.json', 'utf8'))
const configPath = resolve('.wrangler/deploy', redirect.configPath)
const rawConfig = readFileSync(configPath, 'utf8')
const config = JSON.parse(rawConfig)

if (config.name !== EXPECTED.worker) fail(`the build targets Worker "${config.name}", expected "${EXPECTED.worker}".`)
const d1 = (config.d1_databases ?? []).map((d) => d.database_name)
if (d1.length !== 1 || d1[0] !== EXPECTED.d1) fail(`D1 bindings are [${d1.join(', ')}], expected [${EXPECTED.d1}].`)
const r2 = (config.r2_buckets ?? []).map((b) => b.bucket_name)
if (r2.length !== 1 || r2[0] !== EXPECTED.r2) fail(`R2 bindings are [${r2.join(', ')}], expected [${EXPECTED.r2}].`)
const hosts = (config.routes ?? []).map((r) => (typeof r === 'string' ? r : r.pattern)).sort()
if (JSON.stringify(hosts) !== JSON.stringify([...EXPECTED.hosts].sort()))
  fail(`routes are [${hosts.join(', ')}], expected [${EXPECTED.hosts.join(', ')}].`)
assertNoProduction(rawConfig, 'The generated deploy config')
console.log(`\n✔ Generated config targets ${EXPECTED.worker} with dev-only bindings and routes.`)

// 3. Dry run: uploads nothing, prints the bindings wrangler would use.
const dry = run('npx wrangler deploy --dry-run', { capture: true })
if (!dry.includes(EXPECTED.d1) || !dry.includes(EXPECTED.r2)) fail('the dry run does not list the dev D1 and R2 bindings.')
assertNoProduction(dry, 'The dry-run output')
console.log('\n✔ Dry run lists only dev resources.')

if (checkOnly) {
  console.log('\nCheck only: nothing was deployed. Run `npm run deploy:dev` to deploy to my-links-dev.')
  process.exit(0)
}

// 4. Deploy (still reading the dev config verified above).
const out = run('npx wrangler deploy', { capture: true })
if (!out.includes(`Uploaded ${EXPECTED.worker}`)) fail(`the deploy output does not confirm "Uploaded ${EXPECTED.worker}". Check the Cloudflare dashboard.`)
console.log(`\n✔ Deployed ${EXPECTED.worker}. Check https://${EXPECTED.hosts[0]}/`)
