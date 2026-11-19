import type { ApiError } from '../../shared/types'

export class HttpError extends Error {
  status: number
  fields?: Record<string, string>
  constructor(status: number, message: string, fields?: Record<string, string>) {
    super(message)
    this.status = status
    this.fields = fields
  }
}

export function json(data: unknown, init: ResponseInit = {}): Response {
  const headers = new Headers(init.headers)
  headers.set('Content-Type', 'application/json; charset=utf-8')
  if (!headers.has('Cache-Control')) headers.set('Cache-Control', 'no-store')
  return new Response(JSON.stringify(data), { ...init, headers })
}

export function errorResponse(status: number, error: string, fields?: Record<string, string>): Response {
  const body: ApiError = fields ? { error, fields } : { error }
  return json(body, { status })
}

/** Parse a JSON request body with a content-type and size guard. */
export async function readJson(request: Request, maxBytes = 32 * 1024): Promise<unknown> {
  const type = request.headers.get('Content-Type') ?? ''
  if (!type.toLowerCase().startsWith('application/json')) throw new HttpError(415, 'Expected application/json')
  const declared = Number(request.headers.get('Content-Length') ?? 0)
  if (declared > maxBytes) throw new HttpError(413, 'Request body too large')
  const text = await request.text()
  if (text.length > maxBytes) throw new HttpError(413, 'Request body too large')
  try {
    return JSON.parse(text)
  } catch {
    throw new HttpError(400, 'Invalid JSON')
  }
}

export function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost')
}

/**
 * Baseline security headers. The strict CSP is skipped on localhost because Vite's dev
 * server needs inline scripts and websockets for hot reload.
 */
export function withSecurityHeaders(res: Response, opts: { local: boolean; admin?: boolean }): Response {
  const out = new Response(res.body, res)
  const h = out.headers
  h.set('X-Content-Type-Options', 'nosniff')
  h.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  h.set('X-Frame-Options', 'DENY')
  h.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), interest-cohort=()')
  if (!opts.local) {
    h.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
    const type = h.get('Content-Type') ?? ''
    if (type.includes('text/html')) {
      h.set(
        'Content-Security-Policy',
        [
          "default-src 'self'",
          "script-src 'self'",
          "style-src 'self' 'unsafe-inline'",
          "img-src 'self' data: blob:",
          "font-src 'self'",
          "connect-src 'self'",
          "object-src 'none'",
          "base-uri 'none'",
          "form-action 'self'",
          "frame-ancestors 'none'",
        ].join('; '),
      )
    }
  }
  if (opts.admin) {
    h.set('Cache-Control', 'no-store')
    h.set('X-Robots-Tag', 'noindex, nofollow')
  }
  return out
}
