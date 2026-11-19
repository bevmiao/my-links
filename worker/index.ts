/**
 * Worker entry point. Runs before static assets for every request (run_worker_first) and
 * routes by hostname:
 *
 *   PUBLIC_HOSTNAME  →  public profile, /api/profile, /api/track/view, /go/:id, /media/*
 *   ADMIN_HOSTNAME   →  dashboard + /api/admin/*, every request verified against Cloudflare Access
 *   localhost        →  both (admin requires DEV_AUTH_BYPASS="true" in .dev.vars, or a real Access JWT)
 *
 * Any other hostname is treated as public, and admin paths there return 404.
 */
import { authenticateAdmin } from './lib/access'
import { errorResponse, HttpError, isLocalHostname, withSecurityHeaders } from './lib/http'
import { injectProfile } from './lib/html'
import { handleAdminApi } from './routes/admin'
import { getPublicPageData, handlePublicRoute } from './routes/public'

function isAdminPath(pathname: string) {
  return pathname === '/admin' || pathname.startsWith('/admin/') || pathname === '/api/admin' || pathname.startsWith('/api/admin/')
}

async function serveAdmin(request: Request, env: Env, ctx: ExecutionContext, local: boolean): Promise<Response> {
  const url = new URL(request.url)
  const { pathname } = url
  const secure = (r: Response) => withSecurityHeaders(r, { local, admin: true })

  let identity
  try {
    identity = await authenticateAdmin(request, env)
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 401
    const message = e instanceof Error ? e.message : 'Unauthorized'
    if (pathname.startsWith('/api/')) return secure(errorResponse(status, message))
    return secure(
      new Response(`Access denied: ${message}`, { status, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }),
    )
  }

  if (pathname.startsWith('/api/admin')) return secure(await handleAdminApi(request, env, ctx, identity))
  if (pathname === '/') return Response.redirect(new URL('/admin', url).toString(), 302)
  // Uploaded images are needed by the dashboard preview; other public endpoints (tracking,
  // redirects) are deliberately not served on the admin host so the owner doesn't skew stats.
  if (pathname.startsWith('/media/')) return (await handlePublicRoute(request, env, ctx)) ?? secure(errorResponse(404, 'Not found'))
  if (pathname.startsWith('/api/') || pathname.startsWith('/go/')) return secure(errorResponse(404, 'Not found'))
  return secure(await env.ASSETS.fetch(request))
}

async function servePublic(request: Request, env: Env, ctx: ExecutionContext, local: boolean): Promise<Response> {
  const url = new URL(request.url)
  const secure = (r: Response) => withSecurityHeaders(r, { local })

  const routed = await handlePublicRoute(request, env, ctx)
  if (routed) return url.pathname.startsWith('/media/') ? routed : secure(routed)
  if (url.pathname.startsWith('/api/')) return secure(errorResponse(404, 'Not found'))

  if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/' || url.pathname === '/index.html')) {
    const [asset, data] = await Promise.all([
      env.ASSETS.fetch(new Request(new URL('/', url), { headers: request.headers })),
      getPublicPageData(env),
    ])
    const type = asset.headers.get('Content-Type') ?? ''
    if (asset.ok && type.includes('text/html')) {
      const page = injectProfile(asset, data, url.origin)
      const out = new Response(page.body, page)
      out.headers.set('Cache-Control', 'public, max-age=0, must-revalidate')
      out.headers.delete('ETag') // content now varies with the profile
      out.headers.delete('Content-Length')
      return secure(out)
    }
    return secure(asset)
  }

  return secure(await env.ASSETS.fetch(request))
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const local = isLocalHostname(url.hostname)
    try {
      const onAdminHost = url.hostname === env.ADMIN_HOSTNAME
      if (onAdminHost || (local && isAdminPath(url.pathname))) return await serveAdmin(request, env, ctx, local)
      // Admin paths never exist on the public hostname.
      if (isAdminPath(url.pathname)) return withSecurityHeaders(new Response('Not found', { status: 404 }), { local })
      return await servePublic(request, env, ctx, local)
    } catch (e) {
      if (e instanceof HttpError) return withSecurityHeaders(errorResponse(e.status, e.message, e.fields), { local })
      console.error('Unhandled error', e)
      return withSecurityHeaders(errorResponse(500, 'Internal error'), { local })
    }
  },
} satisfies ExportedHandler<Env>
