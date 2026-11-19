/** Admin API. Only reached after authenticateAdmin() succeeds (see worker/index.ts). */
import type { AdminIdentity } from '../../shared/types'
import { validateLinkInput, validateProfileInput } from '../../shared/validation'
import type { AccessIdentity } from '../lib/access'
import { clampRange, getSummary } from '../lib/analytics'
import * as db from '../lib/db'
import { errorResponse, HttpError, json, readJson } from '../lib/http'
import { isImageKind, storeUpload } from '../lib/media'

function parseId(raw: string): number {
  const id = Number(raw)
  if (!Number.isSafeInteger(id) || id <= 0) throw new HttpError(400, 'Invalid id')
  return id
}

export async function handleAdminApi(request: Request, env: Env, ctx: ExecutionContext, identity: AccessIdentity): Promise<Response> {
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/api\/admin/, '') || '/'
  const method = request.method

  // CSRF defence: state-changing requests must come from the dashboard's own origin.
  if (method !== 'GET' && method !== 'HEAD') {
    const origin = request.headers.get('Origin')
    if (origin !== url.origin) return errorResponse(403, 'Cross-origin request blocked')
  }

  if (path === '/me' && method === 'GET') {
    const publicUrl = identity.devBypass ? '/' : `https://${env.PUBLIC_HOSTNAME}/`
    return json({ email: identity.email, devBypass: identity.devBypass, publicUrl } satisfies AdminIdentity)
  }

  /* ---------- Profile ---------- */
  if (path === '/profile') {
    if (method === 'GET') return json(await db.getProfile(env.DB))
    if (method === 'PUT') {
      const result = validateProfileInput(await readJson(request))
      if (!result.ok) return errorResponse(422, 'Please fix the highlighted fields', result.fields)
      return json(await db.updateProfile(env.DB, result.value))
    }
  }

  /* ---------- Images (R2) ---------- */
  const img = path.match(/^\/images\/([a-z]+)$/)
  if (img) {
    const kind = img[1]
    if (!isImageKind(kind)) return errorResponse(404, 'Unknown image type')
    if (method === 'POST') {
      const key = await storeUpload(env.IMAGES, kind, request)
      const previous = await db.getImageKey(env.DB, kind)
      try {
        await db.setImageKey(env.DB, kind, key)
      } catch (e) {
        ctx.waitUntil(env.IMAGES.delete(key)) // don't leave an orphan behind
        throw e
      }
      if (previous) ctx.waitUntil(env.IMAGES.delete(previous))
      return json(await db.getProfile(env.DB))
    }
    if (method === 'DELETE') {
      const previous = await db.getImageKey(env.DB, kind)
      await db.setImageKey(env.DB, kind, null)
      if (previous) ctx.waitUntil(env.IMAGES.delete(previous))
      return json(await db.getProfile(env.DB))
    }
  }

  /* ---------- Links ---------- */
  if (path === '/links') {
    if (method === 'GET') return json(await db.listLinks(env.DB))
    if (method === 'POST') {
      const result = validateLinkInput(await readJson(request))
      if (!result.ok) return errorResponse(422, 'Please fix the highlighted fields', result.fields)
      return json(await db.createLink(env.DB, result.value), { status: 201 })
    }
  }

  if (path === '/links/order' && method === 'PUT') {
    const body = (await readJson(request)) as { ids?: unknown }
    if (!Array.isArray(body?.ids) || !body.ids.every((n) => Number.isSafeInteger(n)))
      return errorResponse(400, 'Expected { ids: number[] }')
    return json(await db.reorderLinks(env.DB, body.ids as number[]))
  }

  const linkMatch = path.match(/^\/links\/([^/]+)$/)
  if (linkMatch) {
    const id = parseId(linkMatch[1])
    if (method === 'GET') {
      const link = await db.getLink(env.DB, id)
      return link ? json(link) : errorResponse(404, 'Link not found')
    }
    if (method === 'PATCH' || method === 'PUT') {
      const existing = await db.getLink(env.DB, id)
      if (!existing) return errorResponse(404, 'Link not found')
      const patch = (await readJson(request)) as Record<string, unknown>
      const merged =
        method === 'PATCH'
          ? {
              title: existing.title,
              url: existing.url,
              description: existing.description,
              icon: existing.icon,
              isActive: existing.isActive,
              ...(patch && typeof patch === 'object' ? patch : {}),
            }
          : patch
      const result = validateLinkInput(merged)
      if (!result.ok) return errorResponse(422, 'Please fix the highlighted fields', result.fields)
      const updated = await db.updateLink(env.DB, id, result.value)
      return updated ? json(updated) : errorResponse(404, 'Link not found')
    }
    if (method === 'DELETE') {
      return (await db.deleteLink(env.DB, id)) ? new Response(null, { status: 204 }) : errorResponse(404, 'Link not found')
    }
  }

  /* ---------- Analytics ---------- */
  if (path === '/analytics' && method === 'GET') {
    const days = clampRange(Number(url.searchParams.get('days') ?? 30))
    return json(await getSummary(env.DB, days))
  }

  return errorResponse(404, 'Not found')
}
