/** Images stored in R2: the profile photo, the background, and client logos. */
import { IMAGE_RULES, sniffImageType, type ImageKind, type ProfileImageKind } from '../../shared/validation'
import { HttpError, readBodyCapped } from './http'

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/** Only keys this Worker generates can be served — no arbitrary bucket reads. */
export const MEDIA_KEY = /^((avatar|background)\/[0-9a-f-]{36}\.(png|jpg|webp|gif)|client-logo\/[0-9a-f-]{36}\.(png|jpg|webp))$/

export function isProfileImageKind(v: string): v is ProfileImageKind {
  return v === 'avatar' || v === 'background'
}

/** Uploaded client logos that nothing uses are kept this long, so a fresh upload can be saved first. */
const ORPHAN_GRACE_MS = 60 * 60 * 1000

/**
 * Delete client logos in R2 that neither the draft nor the published homepage uses (removed or
 * replaced logos, and uploads that were never saved). Recent uploads are left alone.
 */
export async function pruneClientLogos(bucket: R2Bucket, inUse: Set<string>, now = Date.now()): Promise<number> {
  let removed = 0
  let cursor: string | undefined
  do {
    const page = await bucket.list({ prefix: 'client-logo/', cursor })
    const stale = page.objects.filter((o) => !inUse.has(o.key) && now - o.uploaded.getTime() > ORPHAN_GRACE_MS).map((o) => o.key)
    if (stale.length) {
      await bucket.delete(stale)
      removed += stale.length
    }
    cursor = page.truncated ? page.cursor : undefined
  } while (cursor)
  return removed
}

/**
 * Validate and store an uploaded image. Size is checked before buffering, and the real type
 * is detected from the file's magic bytes (the client-declared type is ignored). SVG is not
 * accepted because it can carry script.
 */
export async function storeUpload(bucket: R2Bucket, kind: ImageKind, request: Request): Promise<string> {
  const { maxBytes, label, types } = IMAGE_RULES[kind]
  const contentType = request.headers.get('Content-Type') ?? ''
  if (!contentType.startsWith('multipart/form-data')) throw new HttpError(415, 'Expected multipart/form-data')

  // Cap the raw body while streaming it (multipart overhead gets 16 KB of headroom), then parse
  // the buffered copy, so an oversized upload is rejected before any form parsing happens.
  const body = await readBodyCapped(request, maxBytes + 16 * 1024, `Image must be ${label} or smaller`)

  let form: FormData
  try {
    form = await new Response(body as BodyInit, { headers: { 'Content-Type': contentType } }).formData()
  } catch {
    throw new HttpError(400, 'Invalid form data')
  }
  const file = form.get('file')
  if (!file || typeof file === 'string') throw new HttpError(400, 'No file uploaded')
  if (file.size === 0) throw new HttpError(400, 'The file is empty')
  if (file.size > maxBytes) throw new HttpError(413, `Image must be ${label} or smaller`)

  const bytes = new Uint8Array(await file.arrayBuffer())
  const type = sniffImageType(bytes)
  if (!type || !(types as readonly string[]).includes(type)) {
    const names = types.map((t) => (t === 'image/jpeg' ? 'JPEG' : t === 'image/webp' ? 'WebP' : t.slice(6).toUpperCase()))
    throw new HttpError(415, `Unsupported image. Use ${names.slice(0, -1).join(', ')} or ${names[names.length - 1]}.`)
  }

  const key = `${kind}/${crypto.randomUUID()}.${EXT[type]}`
  await bucket.put(key, bytes, {
    httpMetadata: { contentType: type, cacheControl: 'public, max-age=31536000, immutable' },
  })
  return key
}

export async function serveMedia(bucket: R2Bucket, key: string, request: Request): Promise<Response> {
  if (!MEDIA_KEY.test(key)) return new Response('Not found', { status: 404 })
  const obj = await bucket.get(key, { onlyIf: request.headers })
  if (!obj) return new Response('Not found', { status: 404 })
  const headers = new Headers()
  obj.writeHttpMetadata(headers)
  headers.set('ETag', obj.httpEtag)
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Content-Security-Policy', "default-src 'none'; sandbox")
  if (!('body' in obj)) return new Response(null, { status: 304, headers })
  return new Response((obj as R2ObjectBody).body, { headers })
}
