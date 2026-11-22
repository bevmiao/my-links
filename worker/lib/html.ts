import { PAGE_LABELS, PAGE_PATHS } from '../../shared/homepage'
import type { PageKey, PublicPageData } from '../../shared/types'

/** JSON that is safe to embed inside a <script> element. */
export function safeJsonForHtml(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(new RegExp(String.fromCharCode(0x2028), 'g'), '\\u2028')
    .replace(new RegExp(String.fromCharCode(0x2029), 'g'), '\\u2029')
}

/** Short line for link previews: the published line under the name, else the bio. */
export function shareTagline(data: PublicPageData): string {
  const intro = data.homepage?.sections.find((s) => s.key === 'intro')
  const headline = intro?.key === 'intro' ? intro.intro.headline.trim() : ''
  const text = (headline || data.profile.bio.trim() || `Links from ${data.profile.displayName}`).replace(/\s+/g, ' ')
  return text.length > 200 ? `${text.slice(0, 199).trimEnd()}…` : text
}

/**
 * Server-side enhancement of the public page: embeds the profile data (instant first paint,
 * no loading spinner) and fills in the title, description, Open Graph and Twitter card tags used
 * by link previews (texts, Instagram, Slack, …).
 *
 * `siteOrigin` is the public site's own origin (https://PUBLIC_HOSTNAME, or the local dev server),
 * never the host a request happened to arrive on, so preview images and URLs are always absolute
 * and correct. Everything comes from `data`, which public routes build from the profile and the
 * PUBLISHED homepage only (drafts are never read there).
 * The data block is non-executable (type="application/json"), so the CSP stays strict.
 */
export function injectProfile(res: Response, data: PublicPageData, siteOrigin: string, page: PageKey = 'home'): Response {
  const { profile } = data
  const base = `${profile.displayName} (@${profile.username})`
  const title = page === 'home' ? base : `${PAGE_LABELS[page]} · ${base}`
  const shareTitle = page === 'home' ? profile.displayName : `${PAGE_LABELS[page]} · ${profile.displayName}`
  const pageUrl = `${siteOrigin}${PAGE_PATHS[page]}`
  const tagline = shareTagline(data)
  const image = profile.avatarUrl ? new URL(profile.avatarUrl, siteOrigin).toString() : null
  const imageAlt = `Photo of ${profile.displayName}`

  const meta = (attr: 'name' | 'property', key: string, value: string) =>
    `<meta ${attr}="${key}" content="${escapeAttr(value)}" />`

  const extraHead = [
    meta('name', 'description', tagline),
    meta('property', 'og:type', 'profile'),
    meta('property', 'og:site_name', profile.displayName),
    meta('property', 'og:title', shareTitle),
    meta('property', 'og:description', tagline),
    meta('property', 'og:url', pageUrl),
    meta('property', 'profile:username', profile.username),
    ...(image ? [meta('property', 'og:image', image), meta('property', 'og:image:alt', imageAlt)] : []),
    meta('name', 'twitter:card', 'summary'),
    meta('name', 'twitter:title', shareTitle),
    meta('name', 'twitter:description', tagline),
    ...(image ? [meta('name', 'twitter:image', image), meta('name', 'twitter:image:alt', imageAlt)] : []),
    `<link rel="canonical" href="${escapeAttr(pageUrl)}" />`,
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
