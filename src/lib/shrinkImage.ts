/**
 * Shrinks a photo in the browser before upload, so any size from a phone or camera works and
 * visitors download a small, sharp file. Uses only built-in browser APIs (no dependency).
 *
 * - Resizes so the longest side is at most `maxSide` pixels (never enlarges).
 * - Re-encodes as WebP (or JPEG where WebP encoding isn't available), lowering quality a little
 *   if needed to fit `maxBytes`.
 * - GIFs are left alone so animation isn't lost (they still have to fit the size limit).
 * - If the browser can't decode the file, the original is returned unchanged and the usual
 *   checks (here and on the server) decide.
 *
 * The server still re-validates every upload (size and real file type).
 */
export const SHRINK_MAX_SIDE = { avatar: 800, background: 2400 } as const

/** Larger than this, we don't even try to decode (protects the browser tab). */
export const MAX_INPUT_BYTES = 40 * 1024 * 1024

export async function shrinkImage(file: File, maxSide: number, maxBytes: number): Promise<File> {
  if (file.type === 'image/gif') return file

  let bitmap: ImageBitmap
  try {
    // Modern browsers apply the photo's EXIF rotation here, so phone portraits stay upright.
    bitmap = await createImageBitmap(file)
  } catch {
    return file
  }

  try {
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    // Already small enough in both pixels and bytes: keep the original untouched.
    if (scale === 1 && file.size <= maxBytes && file.type !== 'image/heic' && file.type !== 'image/heif') return file

    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return file
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, 0, 0, width, height)

    let blob: Blob | null = null
    for (const quality of [0.86, 0.8, 0.72, 0.62]) {
      blob = await toBlob(canvas, 'image/webp', quality)
      // Browsers that can't encode WebP silently return PNG; use JPEG there instead.
      if (blob && blob.type !== 'image/webp') blob = await toBlob(canvas, 'image/jpeg', quality)
      if (blob && blob.size <= maxBytes) break
    }
    if (!blob) return file

    const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
    const name = `${file.name.replace(/\.[^.]+$/, '') || 'image'}.${ext}`
    return new File([blob], name, { type: blob.type, lastModified: Date.now() })
  } finally {
    bitmap.close()
  }
}

function toBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
}
