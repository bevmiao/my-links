/**
 * Cloudflare Access integration.
 *
 * Access sits in front of ADMIN_HOSTNAME and only lets the owner through. The Worker does NOT
 * trust that blindly: every admin request must carry a valid `Cf-Access-Jwt-Assertion` JWT,
 * which is verified here (RS256 signature against the team's public keys, audience, issuer,
 * expiry), so the admin API stays protected even if a route is misconfigured or the Worker is
 * reached through another hostname.
 * https://developers.cloudflare.com/cloudflare-one/identity/authorization-cookie/validating-json/
 */
import { HttpError, isLocalHostname } from './http'

export interface AccessIdentity {
  email: string
  devBypass: boolean
}

interface Jwk extends JsonWebKey {
  kid?: string
}

export interface VerifyOptions {
  teamDomain: string
  audience: string
  /** Seconds since epoch; injectable for tests. */
  now?: number
  /** Key source; defaults to fetching the team's JWKS. Injectable for tests. */
  getKeys?: (teamDomain: string, forceRefresh: boolean) => Promise<Jwk[]>
}

const CLOCK_SKEW_SECONDS = 60
const KEY_CACHE_TTL_MS = 60 * 60 * 1000

let keyCache: { teamDomain: string; keys: Jwk[]; fetchedAt: number } | null = null

async function fetchAccessKeys(teamDomain: string, forceRefresh: boolean): Promise<Jwk[]> {
  if (!forceRefresh && keyCache && keyCache.teamDomain === teamDomain && Date.now() - keyCache.fetchedAt < KEY_CACHE_TTL_MS)
    return keyCache.keys
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`)
  if (!res.ok) throw new HttpError(503, 'Could not fetch Cloudflare Access signing keys')
  const body = (await res.json()) as { keys?: Jwk[] }
  const keys = body.keys ?? []
  keyCache = { teamDomain, keys, fetchedAt: Date.now() }
  return keys
}

function b64urlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const pad = s.length % 4 === 0 ? '' : '='.repeat(4 - (s.length % 4))
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function decodeJson(segment: string): Record<string, unknown> {
  try {
    return JSON.parse(new TextDecoder().decode(b64urlToBytes(segment)))
  } catch {
    throw new HttpError(401, 'Malformed Access token')
  }
}

/** Verify a Cloudflare Access JWT and return its claims. Throws HttpError(401) on any failure. */
export async function verifyAccessJwt(token: string, opts: VerifyOptions): Promise<Record<string, unknown>> {
  const parts = token.split('.')
  if (parts.length !== 3) throw new HttpError(401, 'Malformed Access token')
  const [h, p, sig] = parts
  const header = decodeJson(h)
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new HttpError(401, 'Unsupported Access token')

  const getKeys = opts.getKeys ?? fetchAccessKeys
  let jwk = (await getKeys(opts.teamDomain, false)).find((k) => k.kid === header.kid)
  if (!jwk) jwk = (await getKeys(opts.teamDomain, true)).find((k) => k.kid === header.kid) // key rotation
  if (!jwk) throw new HttpError(401, 'Unknown Access signing key')

  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlToBytes(sig), new TextEncoder().encode(`${h}.${p}`))
  if (!valid) throw new HttpError(401, 'Invalid Access token signature')

  const claims = decodeJson(p)
  const now = opts.now ?? Math.floor(Date.now() / 1000)
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud]
  if (!aud.includes(opts.audience)) throw new HttpError(401, 'Access token audience mismatch')
  if (claims.iss !== `https://${opts.teamDomain}`) throw new HttpError(401, 'Access token issuer mismatch')
  if (typeof claims.exp !== 'number' || claims.exp < now - CLOCK_SKEW_SECONDS) throw new HttpError(401, 'Access token expired')
  if (typeof claims.nbf === 'number' && claims.nbf > now + CLOCK_SKEW_SECONDS) throw new HttpError(401, 'Access token not yet valid')
  return claims
}

function isConfigured(v: string | undefined): v is string {
  return !!v && !v.includes('REPLACE_ME')
}

/**
 * Authenticate an admin request. Fails closed: missing configuration is an error, never a pass.
 * The local-development bypass only works on localhost AND when DEV_AUTH_BYPASS="true"
 * (set in .dev.vars, which is never deployed).
 */
export async function authenticateAdmin(request: Request, env: Env, getKeys?: VerifyOptions['getKeys']): Promise<AccessIdentity> {
  const url = new URL(request.url)
  if (env.DEV_AUTH_BYPASS === 'true' && isLocalHostname(url.hostname)) {
    return { email: 'dev@localhost', devBypass: true }
  }

  if (!isConfigured(env.ACCESS_TEAM_DOMAIN) || !isConfigured(env.ACCESS_AUD)) {
    throw new HttpError(500, 'Cloudflare Access is not configured (set ACCESS_TEAM_DOMAIN and ACCESS_AUD)')
  }

  const token = request.headers.get('Cf-Access-Jwt-Assertion')
  if (!token) throw new HttpError(401, 'Missing Cloudflare Access token')

  const claims = await verifyAccessJwt(token, { teamDomain: env.ACCESS_TEAM_DOMAIN, audience: env.ACCESS_AUD, getKeys })
  const email = typeof claims.email === 'string' ? claims.email.toLowerCase() : ''

  const allow = (env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (allow.length && !allow.includes(email)) throw new HttpError(403, 'This account is not allowed to manage this site')

  return { email: email || String(claims.common_name ?? 'service-token'), devBypass: false }
}
