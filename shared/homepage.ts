/**
 * Homepage sections: validation and the public projection, shared by the Worker and the editor.
 * The Worker always re-validates. Each section has its own validator and its own admin route.
 */
import {
  SECTION_KEYS,
  type HomepageContact,
  type HomepageContent,
  type HomepageIntro,
  type HomepageStory,
  type PageKey,
  type PublicHomepage,
  type PublicSection,
  type SectionKey,
  type SectionSetting,
  type ClientItem,
  type PublicClient,
  type SkillItem,
  type VideoItem,
} from './types'
import { clean, normalizeUrl, str, type ValidationResult } from './validation'

export const HOMEPAGE_LIMITS = {
  headline: 120,
  about: 1000,
  storyTitle: 80,
  storyBody: 2000,
  openTo: 200,
  email: 254,
  location: 80,
  skill: 40,
  skills: 30,
  videoTitle: 100,
  videos: 12,
  clientName: 60,
  clients: 24,
  clientTitle: 100,
  clientBullet: 160,
  clientBullets: 8,
  clientImages: 4,
  clientImageAlt: 150,
} as const

/** Headings as visitors see them. The one-sentence section has no heading on the public page. */
export const SECTION_LABELS: Record<SectionKey, string> = {
  intro: 'About',
  story: 'My story',
  skills: 'Skills',
  opportunities: 'Up for',
  videos: 'Videos',
  contact: 'Let’s work!',
  testimonials: 'Kind words',
  clients: 'Trusted by',
}

export const PAGE_LABELS: Record<PageKey, string> = { home: 'Home', about: 'About', work: 'Work' }
export const PAGE_PATHS: Record<PageKey, string> = { home: '/', about: '/about', work: '/work' }

export function pageForPath(path: string): PageKey | null {
  const clean = path.replace(/\/+$/, '') || '/'
  if (clean === '/' || clean === '/index.html') return 'home'
  return (Object.keys(PAGE_PATHS) as PageKey[]).find((p) => PAGE_PATHS[p] === clean) ?? null
}

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/

type Fields = Record<string, string>
const L = HOMEPAGE_LIMITS

function text(v: unknown, max: number, field: string, fields: Fields, opts: { multiline?: boolean; required?: string } = {}) {
  const value = clean(str(v), opts.multiline)
  if (opts.required && !value) fields[field] = opts.required
  else if (value.length > max) fields[field] = `Keep it under ${max} characters.`
  return value
}

/** Optional web link: '' is allowed; anything else must be a valid http(s) URL (not mailto:). */
function optionalWebUrl(v: unknown, field: string, fields: Fields) {
  const raw = str(v)
  if (!raw) return ''
  const url = normalizeUrl(raw)
  if (!url || url.startsWith('mailto:')) {
    fields[field] = 'Enter a valid web address.'
    return ''
  }
  return url
}

function list(v: unknown, max: number, field: string, fields: Fields): unknown[] {
  if (!Array.isArray(v)) {
    fields[field] = 'Expected a list.'
    return []
  }
  if (v.length > max) {
    fields[field] = `At most ${max} items.`
    return []
  }
  return v
}

const done = <T>(fields: Fields, value: T): ValidationResult<T> =>
  Object.keys(fields).length ? { ok: false, fields } : { ok: true, value }

export function validateIntro(body: unknown): ValidationResult<HomepageIntro> {
  const b = (body ?? {}) as Record<string, unknown>
  const f: Fields = {}
  return done(f, {
    headline: text(b.headline, L.headline, 'headline', f),
    about: text(b.about, L.about, 'about', f, { multiline: true }),
  })
}

export function validateStory(body: unknown): ValidationResult<HomepageStory> {
  const b = (body ?? {}) as Record<string, unknown>
  const f: Fields = {}
  return done(f, {
    title: text(b.title, L.storyTitle, 'title', f),
    body: text(b.body, L.storyBody, 'body', f, { multiline: true }),
  })
}

export function validateContact(body: unknown): ValidationResult<HomepageContact> {
  const b = (body ?? {}) as Record<string, unknown>
  const f: Fields = {}
  const email = text(b.email, L.email, 'email', f)
  if (email && !EMAIL.test(email)) f.email = 'Enter a valid email address.'
  if (b.portfolioComingSoon !== undefined && typeof b.portfolioComingSoon !== 'boolean')
    f.portfolioComingSoon = 'Must be true or false.'
  return done(f, {
    email,
    location: text(b.location, L.location, 'location', f),
    portfolioUrl: optionalWebUrl(b.portfolioUrl, 'portfolioUrl', f),
    portfolioComingSoon: b.portfolioComingSoon === undefined ? true : (b.portfolioComingSoon as boolean),
  })
}

export function validateSkills(body: unknown): ValidationResult<SkillItem[]> {
  const f: Fields = {}
  const items = list((body as { items?: unknown })?.items, L.skills, 'items', f).map((item, i) => ({
    label: text((item as Record<string, unknown>)?.label, L.skill, `items.${i}.label`, f, { required: 'Add a skill or remove this one.' }),
  }))
  return done(f, items)
}

const YOUTUBE_ID = /^[A-Za-z0-9_-]{11}$/

/**
 * Pulls the video ID out of anything a person might paste: a watch / share / Shorts / embed / live
 * link from youtube.com, youtu.be or youtube-nocookie.com, or a bare 11-character ID.
 * Returns null for anything else (other sites, playlists, channels).
 */
export function parseYouTubeId(input: string): string | null {
  const raw = input.trim()
  if (YOUTUBE_ID.test(raw)) return raw
  let url: URL
  try {
    url = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const host = url.hostname.toLowerCase().replace(/^(www|m|music)\./, '')
  let id: string | null = null
  if (host === 'youtu.be') id = url.pathname.split('/')[1] ?? null
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v')
    else {
      const m = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/]+)/)
      id = m ? m[1] : null
    }
  }
  return id && YOUTUBE_ID.test(id) ? id : null
}

export function validateVideos(body: unknown): ValidationResult<VideoItem[]> {
  const f: Fields = {}
  const items = list((body as { items?: unknown })?.items, L.videos, 'items', f).map((item, i) => {
    const it = (item ?? {}) as Record<string, unknown>
    const videoId = str(it.videoId)
    if (!YOUTUBE_ID.test(videoId)) f[`items.${i}.videoId`] = 'That isn’t a YouTube video link.'
    return {
      videoId,
      // Required: embedded videos need a title for screen readers.
      title: text(it.title, L.videoTitle, `items.${i}.title`, f, { required: 'Give this video a title.' }),
    }
  })
  return done(f, items)
}

/** An uploaded client logo in R2. Only keys the Worker generated look like this. */
export const CLIENT_LOGO_KEY = /^client-logo\/[0-9a-f-]{36}\.(png|jpg|webp)$/
/** An uploaded photo for a client's pop-up card. */
export const CLIENT_PHOTO_KEY = /^client-photo\/[0-9a-f-]{36}\.(png|jpg|webp)$/
/** Placeholder logos bundled with the site (public/placeholders/), used until real ones are uploaded. */
export const PLACEHOLDER_LOGO_KEY = /^placeholder\/client-[1-4]\.png$/

/** Where a client logo is served from: R2 through /media/, or the bundled placeholder file. */
export function clientLogoUrl(key: string | null): string | null {
  if (!key) return null
  if (CLIENT_LOGO_KEY.test(key)) return `/media/${key}`
  if (PLACEHOLDER_LOGO_KEY.test(key)) return `/placeholders/${key.slice('placeholder/'.length)}`
  return null
}

export function validateClients(body: unknown): ValidationResult<ClientItem[]> {
  const f: Fields = {}
  const items = list((body as { items?: unknown })?.items, L.clients, 'items', f).map((item, i) => {
    const it = (item ?? {}) as Record<string, unknown>
    const name = text(it.name, L.clientName, `items.${i}.name`, f, { required: 'Add the client’s name. It’s also the logo’s alt text.' })
    let logoKey: string | null = null
    if (it.logoKey !== null && it.logoKey !== undefined && it.logoKey !== '') {
      const key = str(it.logoKey)
      if (CLIENT_LOGO_KEY.test(key) || PLACEHOLDER_LOGO_KEY.test(key)) logoKey = key
      else f[`items.${i}.logoKey`] = 'That logo isn’t one of your uploads. Upload it again.'
    }
    const p = `items.${i}`
    const title = text(it.title, L.clientTitle, `${p}.title`, f)
    const bullets = list(it.bullets ?? [], L.clientBullets, `${p}.bullets`, f)
      .map((b, j) => text(b, L.clientBullet, `${p}.bullets.${j}`, f))
      .filter(Boolean) // empty bullets are simply dropped
    const images = list(it.images ?? [], L.clientImages, `${p}.images`, f).map((img, j) => {
      const im = (img ?? {}) as Record<string, unknown>
      const key = str(im.key)
      if (!CLIENT_PHOTO_KEY.test(key)) f[`${p}.images.${j}.key`] = 'That photo isn’t one of your uploads. Upload it again.'
      return { key, alt: text(im.alt, L.clientImageAlt, `${p}.images.${j}.alt`, f) }
    })
    if (it.logoMono !== undefined && typeof it.logoMono !== 'boolean') f[`${p}.logoMono`] = 'Must be true or false.'
    return { name, logoKey, logoMono: it.logoMono === undefined ? true : (it.logoMono as boolean), title, bullets, images }
  })
  return done(f, items)
}

/** A client opens into a pop-up card only when there's something to show in it. */
export function clientHasDetails(c: { title: string; bullets: readonly unknown[]; images: readonly unknown[] }): boolean {
  return !!(c.title || c.bullets.length || c.images.length)
}

/** The one-sentence "what I'm up for" line. */
export function validateOpenTo(body: unknown): ValidationResult<string> {
  const f: Fields = {}
  const sentence = text((body as { sentence?: unknown })?.sentence, L.openTo, 'sentence', f)
  return done(f, sentence)
}

/** Section visibility and order: must list every section key exactly once. */
export function validateSections(body: unknown): ValidationResult<SectionSetting[]> {
  const f: Fields = {}
  const raw = list((body as { items?: unknown })?.items, SECTION_KEYS.length, 'items', f)
  const seen = new Set<string>()
  const items: SectionSetting[] = []
  for (const r of raw) {
    const it = (r ?? {}) as Record<string, unknown>
    const key = str(it.key) as SectionKey
    if (!SECTION_KEYS.includes(key) || seen.has(key) || typeof it.visible !== 'boolean') {
      f.items = 'Include every section exactly once.'
      break
    }
    seen.add(key)
    items.push({ key, visible: it.visible })
  }
  if (!f.items && seen.size !== SECTION_KEYS.length) f.items = 'Include every section exactly once.'
  return done(f, items)
}

/** Ensure every section key appears once, keeping stored order. Unknown keys are dropped; missing ones are hidden. */
export function normalizeSections(stored: SectionSetting[]): SectionSetting[] {
  const out = stored.filter((s, i) => SECTION_KEYS.includes(s.key) && stored.findIndex((x) => x.key === s.key) === i)
  for (const key of SECTION_KEYS) if (!out.some((s) => s.key === key)) out.push({ key, visible: false })
  return out
}

export function emptyHomepage(): HomepageContent {
  return {
    intro: { headline: '', about: '' },
    story: { title: '', body: '' },
    contact: { email: '', location: '', portfolioUrl: '', portfolioComingSoon: true },
    skills: [],
    openTo: '',
    videos: [],
    clients: [],
    sections: SECTION_KEYS.map((key) => ({ key, visible: false })),
  }
}

/**
 * Public projection: only visible sections that have something to show, in order.
 * Content of hidden sections is dropped entirely, so it can never leak through the public API.
 * Used by the Worker (published content) and by the dashboard preview (draft content).
 */
export function toPublicHomepage(content: HomepageContent): PublicHomepage {
  const sections: PublicSection[] = []
  const storyVisible = content.sections.some((s) => s.key === 'story' && s.visible)
  const story = storyVisible && content.story.body ? content.story : null
  for (const { key, visible } of content.sections) {
    if (!visible) continue
    switch (key) {
      case 'intro':
        if (content.intro.headline || content.intro.about) sections.push({ key, intro: content.intro })
        break
      case 'story':
        if (story) sections.push({ key, story })
        break
      case 'skills':
        if (content.skills.length) sections.push({ key, items: content.skills })
        break
      case 'opportunities':
        if (content.openTo) sections.push({ key, sentence: content.openTo })
        break
      case 'videos':
        if (content.videos.length) sections.push({ key, items: content.videos })
        break
      case 'contact': {
        const c = content.contact
        if (c.email || c.location || c.portfolioComingSoon || c.portfolioUrl) {
          // A "coming soon" portfolio never exposes its placeholder URL.
          sections.push({ key, contact: c.portfolioComingSoon ? { ...c, portfolioUrl: '' } : c, story: c.location ? story : null })
        }
        break
      }
      case 'testimonials':
        sections.push({ key })
        break
      case 'clients':
        if (content.clients.length) {
          // Only the name and the logo's URL go public; storage keys stay private.
          const items: PublicClient[] = content.clients.map((c) => ({
            name: c.name,
            logoUrl: clientLogoUrl(c.logoKey),
            logoMono: c.logoMono,
            title: c.title,
            bullets: c.bullets,
            images: c.images.map((img) => ({ url: `/media/${img.key}`, alt: img.alt })),
          }))
          sections.push({ key, items })
        }
        break
    }
  }
  return { sections }
}
