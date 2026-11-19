import { cloudflareTest, readD1Migrations } from '@cloudflare/vitest-plugin'
import { defineConfig } from 'vitest/config'

// Tests run inside workerd (the real Workers runtime) with real local D1 + R2 bindings
// from wrangler.jsonc. Only the hostnames and Access configuration are overridden.
export default defineConfig(async () => {
  const migrations = await readD1Migrations('./migrations')
  return {
    plugins: [
      cloudflareTest({
        wrangler: { configPath: './wrangler.jsonc' },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            // Fixed test hostnames (see test/helpers.ts) so tests don't depend on the real domain.
            PUBLIC_HOSTNAME: 'links.example.com',
            ADMIN_HOSTNAME: 'admin.example.com',
            ACCESS_TEAM_DOMAIN: 'test-team.cloudflareaccess.com',
            ACCESS_AUD: 'test-audience',
            ADMIN_EMAILS: 'owner@example.com',
            // Deliberately ON: proves the bypass is ignored on non-localhost hostnames.
            DEV_AUTH_BYPASS: 'true',
          },
          assets: { directory: './test/fixtures/assets', binding: 'ASSETS', notFoundHandling: 'single-page-application' },
        },
      }),
    ],
    test: {
      include: ['test/**/*.test.ts'],
      setupFiles: ['./test/setup.ts'],
    },
  }
})
