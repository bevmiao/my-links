/** Profile/background images stored in R2. */
import { IMAGE_RULES, sniffImageType, type ImageKind } from '../../shared/validation'
import { HttpError, readBodyCapped } from './http'

const EXT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
}

/** Only keys this Worker generates can be served — no arbitrary bucket reads. */
export const MEDIA_KEY = /^(avatar|background)\/[0-9a-f-]{36}\.(png|jpg|webp|gif)$/

export function isImageKind(v: string): v is ImageKind {
  return v === 'avatar' || v === 'background'
}

/**
 * Validate and store an uploaded image. Size is checked before buffering, and the real type
 * is detected from the file's magic bytes (the client-declared type is ignored). SVG is not
 * accepted because it can carry script.
 */
export async function storeUpload(bucket: R2Bucket, kind: ImageKind, request: Request): Promise<string> {
  const { maxBytes, label } = IMAGE_RULES[kind]
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
  if (!type) throw new HttpError(415, 'Unsupported image. Use PNG, JPEG, WebP or GIF.')

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
