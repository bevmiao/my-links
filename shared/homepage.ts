/**
 * Homepage sections: validation and the public projection, shared by the Worker and the editor.
 * The Worker always re-validates. Each section has its own validator and its own admin route.
 */
import {
  SECTION_KEYS,
  type ExperienceItem,
  type HomepageContact,
  type HomepageContent,
  type HomepageIntro,
  type OpportunityItem,
  type PublicHomepage,
  type PublicSection,
  type SectionKey,
  type SectionSetting,
  type SkillItem,
} from './types'
import { clean, normalizeUrl, str, type ValidationResult } from './validation'

export const HOMEPAGE_LIMITS = {
  headline: 120,
  intro: 280,
  about: 2000,
  background: 2000,
  interest: 40,
  interests: 12,
  email: 254,
  phone: 32,
  location: 80,
  skill: 40,
  skills: 30,
  role: 80,
  organization: 80,
  period: 40,
  experienceDescription: 600,
  experience: 20,
  opportunityTitle: 60,
  opportunityDescription: 200,
  opportunities: 12,
} as const

export const SECTION_LABELS: Record<SectionKey, string> = {
  intro: 'About me',
  experience: 'Experience',
  skills: 'Skills',
  opportunities: 'Open to',
  contact: 'Contact',
  testimonials: 'Testimonials',
}

const EMAIL = /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/
const PHONE = /^[0-9+().\s-]*$/

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
  const interests: string[] = []
  list(b.interests ?? [], L.interests, 'interests', f).forEach((item, i) => {
    const v = text(item, L.interest, `interests.${i}`, f)
    if (v) interests.push(v)
  })
  return done(f, {
    headline: text(b.headline, L.headline, 'headline', f),
    intro: text(b.intro, L.intro, 'intro', f, { multiline: true }),
    about: text(b.about, L.about, 'about', f, { multiline: true }),
    background: text(b.background, L.background, 'background', f, { multiline: true }),
    interests,
  })
}

export function validateContact(body: unknown): ValidationResult<HomepageContact> {
  const b = (body ?? {}) as Record<string, unknown>
  const f: Fields = {}
  const email = text(b.email, L.email, 'email', f)
  if (email && !EMAIL.test(email)) f.email = 'Enter a valid email address.'
  const phone = text(b.phone, L.phone, 'phone', f)
  if (phone && !PHONE.test(phone)) f.phone = 'Use digits, spaces, and + ( ) - only.'
  if (b.portfolioComingSoon !== undefined && typeof b.portfolioComingSoon !== 'boolean')
    f.portfolioComingSoon = 'Must be true or false.'
  return done(f, {
    email,
    phone,
    location: text(b.location, L.location, 'location', f),
    linkedinUrl: optionalWebUrl(b.linkedinUrl, 'linkedinUrl', f),
    resumeUrl: optionalWebUrl(b.resumeUrl, 'resumeUrl', f),
    portfolioUrl: optionalWebUrl(b.portfolioUrl, 'portfolioUrl', f),
    portfolioComingSoon: b.portfolioComingSoon === undefined ? true : (b.portfolioComingSoon as boolean),
  })
}

export function validateSkills(body: unknown): ValidationResult<SkillItem[]> {
  const f: Fields = {}
  const items = list((body as { items?: unknown })?.items, L.skills, 'items', f).map((item, i) => ({
    label: text((item as Record<string, unknown>)?.label, L.skill, `items.${i}.label`, f, { required: 'Add a skill or remove this row.' }),
  }))
  return done(f, items)
}

export function validateExperience(body: unknown): ValidationResult<ExperienceItem[]> {
  const f: Fields = {}
  const items = list((body as { items?: unknown })?.items, L.experience, 'items', f).map((raw, i) => {
    const it = (raw ?? {}) as Record<string, unknown>
    return {
      role: text(it.role, L.role, `items.${i}.role`, f, { required: 'Add a role or remove this entry.' }),
      organization: text(it.organization, L.organization, `items.${i}.organization`, f),
      period: text(it.period, L.period, `items.${i}.period`, f),
      description: text(it.description, L.experienceDescription, `items.${i}.description`, f, { multiline: true }),
    }
  })
  return done(f, items)
}

export function validateOpportunities(body: unknown): ValidationResult<OpportunityItem[]> {
  const f: Fields = {}
  const items = list((body as { items?: unknown })?.items, L.opportunities, 'items', f).map((raw, i) => {
    const it = (raw ?? {}) as Record<string, unknown>
    return {
      title: text(it.title, L.opportunityTitle, `items.${i}.title`, f, { required: 'Add a title or remove this row.' }),
      description: text(it.description, L.opportunityDescription, `items.${i}.description`, f),
    }
  })
  return done(f, items)
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

/** Ensure every section key appears once, keeping stored order. Unknown or missing keys are hidden. */
export function normalizeSections(stored: SectionSetting[]): SectionSetting[] {
  const out = stored.filter((s, i) => SECTION_KEYS.includes(s.key) && stored.findIndex((x) => x.key === s.key) === i)
  for (const key of SECTION_KEYS) if (!out.some((s) => s.key === key)) out.push({ key, visible: false })
  return out
}

export function emptyHomepage(): HomepageContent {
  return {
    intro: { headline: '', intro: '', about: '', background: '', interests: [] },
    contact: { email: '', phone: '', location: '', linkedinUrl: '', resumeUrl: '', portfolioUrl: '', portfolioComingSoon: true },
    skills: [],
    experience: [],
    opportunities: [],
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
      case 'intro': {
        const i = content.intro
        if (i.headline || i.intro || i.about || i.background || i.interests.length) sections.push({ key, intro: i })
        break
      }
      case 'contact': {
        const c = content.contact
        const portfolioShown = c.portfolioComingSoon || !!c.portfolioUrl
        if (c.email || c.phone || c.location || c.linkedinUrl || c.resumeUrl || portfolioShown) {
          // A "coming soon" portfolio never exposes its placeholder URL.
          sections.push({ key, contact: c.portfolioComingSoon ? { ...c, portfolioUrl: '' } : c })
        }
        break
      }
      case 'experience':
      case 'skills':
      case 'opportunities':
        if (content[key].length) sections.push({ key, items: content[key] } as PublicSection)
        break
      case 'testimonials':
        sections.push({ key })
        break
    }
  }
  return { sections }
}
