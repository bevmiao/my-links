/**
 * Suggests whether a client logo can be drawn in one colour (the page's text colour, used as a
 * mask on the public site). That only works for logos that are a single shape on a transparent
 * background:
 *
 * - it needs transparency (a solid background would become a plain block),
 * - it shouldn't be colourful (the colours would be lost), and
 * - it shouldn't be two-tone, like a white letter inside a black circle (the inner shape is
 *   opaque too, so it would vanish into a solid disc).
 *
 * Runs in the browser on a small copy of the image. If the image can't be read, it says no, which
 * keeps the logo's own colours.
 */
export async function suggestOneColour(file: Blob): Promise<boolean> {
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    return false
  }
  try {
    const scale = Math.min(1, 160 / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return false
    ctx.drawImage(bitmap, 0, 0, w, h)
    const d = ctx.getImageData(0, 0, w, h).data

    let transparent = 0
    let visible = 0
    let colourful = 0
    let light = 0
    let dark = 0
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 16) {
        transparent++
        continue
      }
      if (d[i + 3] < 200) continue // soft edges say nothing about the colours
      visible++
      const [r, g, b] = [d[i], d[i + 1], d[i + 2]]
      if (Math.max(r, g, b) - Math.min(r, g, b) > 40) colourful++
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
      if (lum > 200) light++
      else if (lum < 60) dark++
    }
    const pixels = d.length / 4
    if (!visible || transparent / pixels < 0.05) return false
    if (colourful / visible > 0.15) return false
    if (light / visible > 0.1 && dark / visible > 0.1) return false
    return true
  } finally {
    bitmap.close()
  }
}
