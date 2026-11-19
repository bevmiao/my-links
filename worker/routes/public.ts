import type { PublicPageData } from '../../shared/types'
import { isBot, recordEvent, referrerHost } from '../lib/analytics'
import { getActiveLinkUrl, getProfile, listPublicLinks } from '../lib/db'
import { json } from '../lib/http'
import { serveMedia } from '../lib/media'

export async function getPublicPageData(env: Env): Promise<PublicPageData> {
  const [profile, links] = await Promise.all([getProfile(env.DB), listPublicLinks(env.DB)])
  return { profile, links }
}

/** Public, unauthenticated routes. Returns null when the path isn't one of them. */
export async function handlePublicRoute(request: Request, env: Env, ctx: ExecutionContext): Promise<Response | null> {
  const url = new URL(request.url)
  const { pathname } = url
  const method = request.method

  if (pathname === '/api/profile' && method === 'GET') {
    return json(await getPublicPageData(env), { headers: { 'Cache-Control': 'no-cache' } })
  }

  if (pathname === '/api/track/view' && method === 'POST') {
    if (!isBot(request)) {
      let referrer: string | null = null
      try {
        const text = await request.text()
        if (text.length <= 4096) referrer = referrerHost((JSON.parse(text) as { referrer?: unknown }).referrer, [url.hostname, env.PUBLIC_HOSTNAME, env.ADMIN_HOSTNAME])
      } catch {
        /* empty / invalid body → direct */
      }
      ctx.waitUntil(recordEvent(env.DB, request, { type: 'view', referrer }).catch((e) => console.error('track view failed', e)))
    }
    return new Response(null, { status: 204 })
  }

  // Click tracking redirect. Only active links resolve, so this can't be used as an open redirect.
  const go = pathname.match(/^\/go\/(\d{1,10})$/)
  if (go && (method === 'GET' || method === 'HEAD')) {
    const id = Number(go[1])
    const target = await getActiveLinkUrl(env.DB, id)
    if (!target) return Response.redirect(new URL('/', url).toString(), 302)
    if (method === 'GET' && !isBot(request)) {
      ctx.waitUntil(recordEvent(env.DB, request, { type: 'click', linkId: id }).catch((e) => console.error('track click failed', e)))
    }
    return new Response(null, {
      status: 302,
      headers: { Location: target, 'Cache-Control': 'no-store', 'Referrer-Policy': 'origin' },
    })
  }

  if (pathname.startsWith('/media/') && (method === 'GET' || method === 'HEAD')) {
    return serveMedia(env.IMAGES, pathname.slice('/media/'.length), request)
  }

  return null
}
