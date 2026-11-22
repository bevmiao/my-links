/** Admin API. Only reached after authenticateAdmin() succeeds (see worker/index.ts). */
import type { AdminIdentity } from '../../shared/types'
import {
  CLIENT_LOGO_KEY,
  clientLogoUrl,
  validateClients,
  validateContact,
  validateIntro,
  validateOpenTo,
  validateSections,
  validateSkills,
  validateStory,
  validateVideos,
} from '../../shared/homepage'
import { validateLinkInput, validateProfileInput, type ValidationResult } from '../../shared/validation'
import type { AccessIdentity } from '../lib/access'
import { clampRange, getSummary } from '../lib/analytics'
import * as db from '../lib/db'
import * as hp from '../lib/homepage'
import { errorResponse, HttpError, json, readJson } from '../lib/http'
import { isProfileImageKind, pruneClientLogos, storeUpload } from '../lib/media'

type Saver = (db: D1Database, body: unknown) => Promise<Record<string, string> | null>

/** Validate a section and write it to the draft. Returns field errors, or null on success. */
function saver<T>(validate: (b: unknown) => ValidationResult<T>, save: (db: D1Database, v: T) => Promise<void>): Saver {
  return async (db, body) => {
    const r = validate(body)
    if (!r.ok) return r.fields
    await save(db, r.value)
    return null
  }
}

/** One draft route per homepage section: PUT /api/admin/homepage/<section>. */
const HOMEPAGE_SAVERS: Record<string, Saver> = {
  intro: saver(validateIntro, hp.saveIntroDraft),
  contact: saver(validateContact, hp.saveContactDraft),
  skills: saver(validateSkills, hp.saveSkillsDraft),
  'open-to': saver(validateOpenTo, hp.saveOpenToDraft),
  story: saver(validateStory, hp.saveStoryDraft),
  videos: saver(validateVideos, hp.saveVideosDraft),
  sections: saver(validateSections, hp.saveSectionsDraft),
}

/** Remove client logos no copy of the homepage uses any more. Never fails the request. */
async function pruneLogos(env: Env) {
  try {
    await pruneClientLogos(env.IMAGES, await hp.clientLogoKeysInUse(env.DB))
  } catch (e) {
    console.error('client logo cleanup failed', e)
  }
}

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
  // Client logos: stored on upload and returned as { key, url }. A logo only appears on the site
  // once its key is saved in the clients draft and published. Unused uploads are pruned later.
  if (path === '/images/client-logo' && method === 'POST') {
    const key = await storeUpload(env.IMAGES, 'client-logo', request)
    return json({ key, url: clientLogoUrl(key) }, { status: 201 })
  }

  const img = path.match(/^\/images\/([a-z]+)$/)
  if (img) {
    const kind = img[1]
    if (!isProfileImageKind(kind)) return errorResponse(404, 'Unknown image type')
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
              category: existing.category,
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

  /* ---------- Homepage sections (draft / publish) ---------- */
  if (path === '/homepage' && method === 'GET') return json(await hp.getHomepageAdminState(env.DB))

  if (path === '/homepage/publish' && method === 'POST') {
    await hp.publishHomepage(env.DB)
    ctx.waitUntil(pruneLogos(env))
    return json(await hp.getHomepageAdminState(env.DB))
  }
  if (path === '/homepage/discard' && method === 'POST') {
    await hp.discardHomepageDraft(env.DB)
    ctx.waitUntil(pruneLogos(env))
    return json(await hp.getHomepageAdminState(env.DB))
  }

  if (path === '/homepage/clients' && method === 'PUT') {
    const result = validateClients(await readJson(request, 64 * 1024))
    if (!result.ok) return errorResponse(422, 'Please fix the highlighted fields', result.fields)
    // Uploaded logos must really exist in R2, so a stale or made-up key can't leave a broken image.
    const missing: Record<string, string> = {}
    await Promise.all(
      result.value.map(async (c, i) => {
        if (c.logoKey && CLIENT_LOGO_KEY.test(c.logoKey) && !(await env.IMAGES.head(c.logoKey)))
          missing[`items.${i}.logoKey`] = 'That logo is missing. Upload it again.'
      }),
    )
    if (Object.keys(missing).length) return errorResponse(422, 'Please fix the highlighted fields', missing)
    await hp.saveClientsDraft(env.DB, result.value)
    ctx.waitUntil(pruneLogos(env))
    return json(await hp.getHomepageAdminState(env.DB))
  }

  const section = path.match(/^\/homepage\/([a-z-]+)$/)
  if (section && method === 'PUT') {
    const saver = Object.hasOwn(HOMEPAGE_SAVERS, section[1]) ? HOMEPAGE_SAVERS[section[1]] : undefined
    if (!saver) return errorResponse(404, 'Unknown section')
    const body = await readJson(request, 64 * 1024)
    const fields = await saver(env.DB, body)
    if (fields) return errorResponse(422, 'Please fix the highlighted fields', fields)
    return json(await hp.getHomepageAdminState(env.DB))
  }

  /* ---------- Analytics ---------- */
  if (path === '/analytics' && method === 'GET') {
    const days = clampRange(Number(url.searchParams.get('days') ?? 30))
    return json(await getSummary(env.DB, days))
  }

  return errorResponse(404, 'Not found')
}
