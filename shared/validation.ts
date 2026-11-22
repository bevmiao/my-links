/**
 * Input validation shared by the Worker and the dashboard.
 * The Worker always re-validates — client-side use is only for friendlier form feedback.
 */
import type { ButtonStyle, GrainMode, LinkInput, ProfileInput, SocialLink, ThemeMode } from './types'

export const LIMITS = {
  username: 32,
  displayName: 64,
  bio: 280,
  linkTitle: 80,
  linkDescription: 160,
  url: 2048,
  icon: 32,
  linkCategory: 40,
  socials: 12,
  links: 100,
} as const

export const IMAGE_RULES = {
  avatar: { maxBytes: 2 * 1024 * 1024, label: '2 MB' },
  background: { maxBytes: 5 * 1024 * 1024, label: '5 MB' },
} as const
export type ImageKind = keyof typeof IMAGE_RULES
export const ALLOWED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const

export const THEME_MODES: ThemeMode[] = ['light', 'dark', 'system']
export const BUTTON_STYLES: ButtonStyle[] = ['rounded', 'pill', 'square']
export const GRAIN_MODES: GrainMode[] = ['moving', 'still', 'off']

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; fields: Record<string, string> }

const HEX = /^#[0-9a-fA-F]{6}$/
const USERNAME = /^[a-zA-Z0-9._-]+$/
const ICON = /^[a-z0-9-]*$/
const PLATFORM = /^[a-z0-9-]{1,24}$/

export function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : ''
}

/** Strip ASCII control characters (keeps newlines in multi-line fields). */
export function clean(v: string, allowNewlines = false): string {
  // eslint-disable-next-line no-control-regex
  const re = allowNewlines ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g
  return v.replace(re, '')
}

/**
 * Accept only absolute http(s) and mailto: URLs. Blocks javascript:, data:, etc.
 * Returns the normalised URL or null.
 */
export function normalizeUrl(input: unknown): string | null {
  const raw = str(input)
  if (!raw || raw.length > LIMITS.url) return null
  let candidate = raw
  // Friendly: "example.com" → "https://example.com"
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(candidate)) candidate = `https://${candidate}`
  let parsed: URL
  try {
    parsed = new URL(candidate)
  } catch {
    return null
  }
  if (parsed.protocol === 'mailto:') {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(decodeURIComponent(parsed.pathname)) ? parsed.href : null
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
  if (!parsed.hostname || !parsed.hostname.includes('.') || parsed.username || parsed.password) return null
  return parsed.href
}

export function validateLinkInput(body: unknown): ValidationResult<LinkInput> {
  const b = (body ?? {}) as Record<string, unknown>
  const fields: Record<string, string> = {}

  const title = clean(str(b.title))
  if (!title) fields.title = 'Title is required.'
  else if (title.length > LIMITS.linkTitle) fields.title = `Keep it under ${LIMITS.linkTitle} characters.`

  const url = normalizeUrl(b.url)
  if (!url) fields.url = 'Enter a valid http(s) or mailto: URL.'

  const description = clean(str(b.description))
  if (description.length > LIMITS.linkDescription)
    fields.description = `Keep it under ${LIMITS.linkDescription} characters.`

  const icon = str(b.icon)
  if (icon.length > LIMITS.icon || !ICON.test(icon)) fields.icon = 'Unknown icon.'

  const category = clean(str(b.category)).replace(/\s+/g, ' ')
  if (category.length > LIMITS.linkCategory) fields.category = `Keep it under ${LIMITS.linkCategory} characters.`

  if (b.isActive !== undefined && typeof b.isActive !== 'boolean') fields.isActive = 'Must be true or false.'

  if (Object.keys(fields).length) return { ok: false, fields }
  return {
    ok: true,
    value: { title, url: url!, description, icon, category, isActive: b.isActive === undefined ? true : (b.isActive as boolean) },
  }
}

export function validateSocials(input: unknown): ValidationResult<SocialLink[]> {
  if (!Array.isArray(input)) return { ok: false, fields: { socials: 'Socials must be a list.' } }
  if (input.length > LIMITS.socials) return { ok: false, fields: { socials: `At most ${LIMITS.socials} social links.` } }
  const out: SocialLink[] = []
  for (const [i, item] of input.entries()) {
    const it = (item ?? {}) as Record<string, unknown>
    const platform = str(it.platform)
    if (!PLATFORM.test(platform)) return { ok: false, fields: { [`socials.${i}`]: 'Unknown platform.' } }
    const url = normalizeUrl(it.url)
    if (!url) return { ok: false, fields: { [`socials.${i}`]: 'Enter a valid URL.' } }
    out.push({ platform, url })
  }
  return { ok: true, value: out }
}

export function validateProfileInput(body: unknown): ValidationResult<ProfileInput> {
  const b = (body ?? {}) as Record<string, unknown>
  const fields: Record<string, string> = {}

  const username = str(b.username).replace(/^@/, '')
  if (!username) fields.username = 'Username is required.'
  else if (username.length > LIMITS.username || !USERNAME.test(username))
    fields.username = `Letters, numbers, dots, dashes and underscores; max ${LIMITS.username}.`

  const displayName = clean(str(b.displayName))
  if (!displayName) fields.displayName = 'Display name is required.'
  else if (displayName.length > LIMITS.displayName) fields.displayName = `Max ${LIMITS.displayName} characters.`

  const bio = clean(str(b.bio), true)
  if (bio.length > LIMITS.bio) fields.bio = `Max ${LIMITS.bio} characters.`

  const themeMode = str(b.themeMode) as ThemeMode
  if (!THEME_MODES.includes(themeMode)) fields.themeMode = 'Choose light, dark or system.'

  // Optional for older clients: missing means the default animated grain.
  const grain = (b.grain === undefined ? 'moving' : str(b.grain)) as GrainMode
  if (!GRAIN_MODES.includes(grain)) fields.grain = 'Choose moving, still or off.'

  const buttonStyle = str(b.buttonStyle) as ButtonStyle
  if (!BUTTON_STYLES.includes(buttonStyle)) fields.buttonStyle = 'Choose a button style.'

  const colors = ['accentColor', 'backgroundLight', 'backgroundDark'] as const
  const colorValues: Record<string, string> = {}
  for (const key of colors) {
    const v = str(b[key])
    if (!HEX.test(v)) fields[key] = 'Use a hex colour like #6366f1.'
    colorValues[key] = v.toLowerCase()
  }

  const socials = validateSocials(b.socials ?? [])
  if (!socials.ok) Object.assign(fields, socials.fields)

  if (Object.keys(fields).length) return { ok: false, fields }
  return {
    ok: true,
    value: {
      username,
      displayName,
      bio,
      themeMode,
      buttonStyle,
      grain,
      accentColor: colorValues.accentColor,
      backgroundLight: colorValues.backgroundLight,
      backgroundDark: colorValues.backgroundDark,
      socials: socials.ok ? socials.value : [],
    },
  }
}

/** Detect the real image type from magic bytes (never trust the client's Content-Type). */
export function sniffImageType(bytes: Uint8Array): (typeof ALLOWED_IMAGE_TYPES)[number] | null {
  const b = bytes
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a)
    return 'image/png'
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg'
  if (b.length >= 6 && b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38 && (b[4] === 0x37 || b[4] === 0x39) && b[5] === 0x61)
    return 'image/gif'
  if (b.length >= 12 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50)
    return 'image/webp'
  return null
}
