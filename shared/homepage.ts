/**
 * Homepage sections: validation and the public projection, shared by the Worker and the editor.
 * The Worker always re-validates. Each section has its own validator and its own admin route.
 */
import {
  SECTION_KEYS,
  type HomepageContact,
  type HomepageContent,
  type HomepageIntro,
  type PublicHomepage,
  type PublicSection,
  type SectionKey,
  type SectionSetting,
  type SkillItem,
} from './types'
import { clean, normalizeUrl, str, type ValidationResult } from './validation'

export const HOMEPAGE_LIMITS = {
  headline: 120,
  about: 1000,
  openTo: 200,
  email: 254,
  location: 80,
  skill: 40,
  skills: 30,
} as const

/** Headings as visitors see them. The one-sentence section has no heading on the public page. */
export const SECTION_LABELS: Record<SectionKey, string> = {
  intro: 'About',
  skills: 'Skills',
  opportunities: 'Up for',
  contact: 'Say hi',
  testimonials: 'Kind words',
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
    contact: { email: '', location: '', portfolioUrl: '', portfolioComingSoon: true },
    skills: [],
    openTo: '',
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
  for (const { key, visible } of content.sections) {
    if (!visible) continue
    switch (key) {
      case 'intro':
        if (content.intro.headline || content.intro.about) sections.push({ key, intro: content.intro })
        break
      case 'skills':
        if (content.skills.length) sections.push({ key, items: content.skills })
        break
      case 'opportunities':
        if (content.openTo) sections.push({ key, sentence: content.openTo })
        break
      case 'contact': {
        const c = content.contact
        if (c.email || c.location || c.portfolioComingSoon || c.portfolioUrl) {
          // A "coming soon" portfolio never exposes its placeholder URL.
          sections.push({ key, contact: c.portfolioComingSoon ? { ...c, portfolioUrl: '' } : c })
        }
        break
      }
      case 'testimonials':
        sections.push({ key })
        break
    }
  }
  return { sections }
}
