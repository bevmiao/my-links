import { applyD1Migrations } from 'cloudflare:test'
import { env } from 'cloudflare:workers'

// Each test file gets isolated storage; apply the real migrations before tests run.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS)
