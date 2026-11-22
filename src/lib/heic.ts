/**
 * iPhone photos are usually HEIC. Safari can open them, but Chrome, Edge and Firefox can't, so the
 * dashboard converts them to JPEG in the browser before the usual resizing and upload.
 *
 * The converter (heic-to, LGPL-3.0, owner-approved 2026-11-22) is a few MB of WebAssembly, so it is
 * loaded only when a HEIC photo is actually picked, and only in the dashboard. Its "csp" build is
 * used: no eval. It runs in a blob: Web Worker and compiles WebAssembly, which the admin site's CSP
 * allows (worker-src blob:, 'wasm-unsafe-eval'); the public site's CSP does not, and never loads it.
 * Nothing is sent anywhere: the photo is converted on this device.
 */

/** HEIC/HEIF by type or file name (Windows often reports an empty type for .heic files). */
export function looksLikeHeic(file: File): boolean {
  return /^image\/hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name)
}

/** Any photo we can handle: a declared image type, or a HEIC file whatever its declared type. */
export function isPhotoFile(file: File): boolean {
  return (file.type.startsWith('image/') && file.type !== 'image/svg+xml') || looksLikeHeic(file)
}

/** Converts a HEIC photo to a JPEG file (full size; it is resized afterwards). */
export async function heicToJpeg(file: File): Promise<File> {
  const { heicTo } = await import('heic-to/csp')
  const jpeg = await heicTo({ blob: file, type: 'image/jpeg', quality: 0.92 })
  const name = `${file.name.replace(/\.[^.]+$/, '') || 'photo'}.jpg`
  return new File([jpeg], name, { type: 'image/jpeg', lastModified: Date.now() })
}

/**
 * Returns a file the browser can open: the original if it can already decode it (Safari opens
 * HEIC natively, so it never downloads the converter), otherwise a JPEG converted from HEIC.
 * Non-HEIC files are returned unchanged.
 */
export async function openableImage(file: File): Promise<File> {
  if (!looksLikeHeic(file)) return file
  try {
    ;(await createImageBitmap(file)).close()
    return file
  } catch {
    try {
      return await heicToJpeg(file)
    } catch {
      throw new Error('That HEIC photo couldn’t be converted. Try exporting it as a JPEG.')
    }
  }
}
