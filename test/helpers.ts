import { exports } from 'cloudflare:workers'
import { vi } from 'vitest'

export const PUBLIC = 'https://links.example.com'
export const ADMIN = 'https://admin.example.com'
export const TEAM = 'test-team.cloudflareaccess.com'
export const AUD = 'test-audience'
export const BROWSER_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/605.1.15 Safari/605.1.15'

const b64url = (bytes: Uint8Array | ArrayBuffer) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
const b64urlJson = (v: unknown) => b64url(new TextEncoder().encode(JSON.stringify(v)))

/** A real RSA key pair standing in for the Access team's signing key. */
export async function createSigner(kid = 'test-kid') {
  const pair = (await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  )) as CryptoKeyPair
  const jwk = { ...((await crypto.subtle.exportKey('jwk', pair.publicKey)) as JsonWebKey), kid }

  async function sign(claims: Record<string, unknown>, header: Record<string, unknown> = {}) {
    const h = b64urlJson({ alg: 'RS256', kid, typ: 'JWT', ...header })
    const p = b64urlJson(claims)
    const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', pair.privateKey, new TextEncoder().encode(`${h}.${p}`))
    return `${h}.${p}.${b64url(sig)}`
  }

  return { jwk, sign }
}

export function validClaims(overrides: Record<string, unknown> = {}) {
  const now = Math.floor(Date.now() / 1000)
  return { aud: [AUD], iss: `https://${TEAM}`, email: 'owner@example.com', iat: now, nbf: now, exp: now + 600, ...overrides }
}

/** Serve the signer's public key at the Access certs URL (the only outbound fetch the Worker makes). */
export function mockAccessCerts(jwks: JsonWebKey[]) {
  const real = globalThis.fetch
  return vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (url === `https://${TEAM}/cdn-cgi/access/certs`) return Response.json({ keys: jwks })
    return real(input, init)
  })
}

export function call(url: string, init: RequestInit = {}) {
  return exports.default.fetch(new Request(url, init))
}

/** Authenticated admin request (JWT header + same-origin Origin for mutations). */
export function adminCall(token: string, path: string, init: RequestInit & { json?: unknown } = {}) {
  const headers = new Headers(init.headers)
  headers.set('Cf-Access-Jwt-Assertion', token)
  if (init.method && init.method !== 'GET' && !headers.has('Origin')) headers.set('Origin', ADMIN)
  let body = init.body
  if (init.json !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(init.json)
  }
  return call(`${ADMIN}${path}`, { ...init, headers, body })
}

/** Analytics are written via ctx.waitUntil; poll briefly until the condition holds. */
export async function eventually<T>(fn: () => Promise<T>, ok: (v: T) => boolean, tries = 40): Promise<T> {
  let last!: T
  for (let i = 0; i < tries; i++) {
    last = await fn()
    if (ok(last)) return last
    await new Promise((r) => setTimeout(r, 25))
  }
  return last
}

export function pngBytes(): Uint8Array {
  // Valid 1×1 PNG.
  return Uint8Array.from(
    atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='),
    (c) => c.charCodeAt(0),
  )
}
