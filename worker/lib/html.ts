import type { PublicPageData } from '../../shared/types'

/** JSON that is safe to embed inside a <script> element. */
export function safeJsonForHtml(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028')
    .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029')
}

/**
 * Server-side enhancement of the public page: embeds the profile data (instant first paint,
 * no loading spinner) and fills in title / description / Open Graph tags for link previews.
 * The data block is non-executable (type="application/json"), so the CSP stays strict.
 */
export function injectProfile(res: Response, data: PublicPageData, origin: string): Response {
  const { profile } = data
  const title = `${profile.displayName} (@${profile.username})`
  const description = profile.bio || `Links from ${profile.displayName}`
  const image = profile.avatarUrl ? new URL(profile.avatarUrl, origin).toString() : null

  const meta = (attr: 'name' | 'property', key: string, value: string) =>
    `<meta ${attr}="${key}" content="${escapeAttr(value)}" />`

  const extraHead = [
    meta('name', 'description', description),
    meta('property', 'og:type', 'profile'),
    meta('property', 'og:title', title),
    meta('property', 'og:description', description),
    meta('property', 'og:url', `${origin}/`),
    image ? meta('property', 'og:image', image) : '',
    meta('name', 'twitter:card', 'summary'),
    `<link rel="canonical" href="${escapeAttr(origin)}/" />`,
  ].join('')

  return new HTMLRewriter()
    .on('head', {
      element(el) {
        // Prepended so /theme-init.js (in <head>) can read it before first paint.
        el.prepend(`<script type="application/json" id="initial-data">${safeJsonForHtml(data)}</script>`, { html: true })
        el.append(extraHead, { html: true })
      },
    })
    .on('title', {
      element(el) {
        el.setInnerContent(title)
      },
    })
    // Replaced (not edited in place) so the value goes through our own attribute escaping.
    .on('meta[name="description"]', {
      element(el) {
        el.remove()
      },
    })
    .transform(res)
}

function escapeAttr(s: string) {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
