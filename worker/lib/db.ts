/** D1 queries for the profile and links. All statements use bound parameters. */
import type { Link, LinkInput, Profile, ProfileInput, PublicLink, SocialLink } from '../../shared/types'
import { LIMITS, type ProfileImageKind } from '../../shared/validation'
import { HttpError } from './http'

interface ProfileRow {
  username: string
  display_name: string
  bio: string
  avatar_key: string | null
  background_key: string | null
  theme_mode: Profile['themeMode']
  accent_color: string
  background_light: string
  background_dark: string
  button_style: Profile['buttonStyle']
  grain: Profile['grain']
  socials: string
  updated_at: string
}

interface LinkRow {
  id: number
  title: string
  url: string
  description: string
  icon: string
  category: string
  is_active: number
  sort_order: number
  created_at: string
  updated_at: string
}

export const mediaUrl = (key: string | null) => (key ? `/media/${key}` : null)

function parseSocials(raw: string): SocialLink[] {
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((s) => s && typeof s.platform === 'string' && typeof s.url === 'string') : []
  } catch {
    return []
  }
}

const toIso = (sqlTime: string) => `${sqlTime.replace(' ', 'T')}Z`

function toProfile(r: ProfileRow): Profile {
  return {
    username: r.username,
    displayName: r.display_name,
    bio: r.bio,
    avatarUrl: mediaUrl(r.avatar_key),
    backgroundUrl: mediaUrl(r.background_key),
    themeMode: r.theme_mode,
    accentColor: r.accent_color,
    backgroundLight: r.background_light,
    backgroundDark: r.background_dark,
    buttonStyle: r.button_style,
    grain: r.grain,
    socials: parseSocials(r.socials),
    updatedAt: toIso(r.updated_at),
  }
}

function toLink(r: LinkRow): Link {
  return {
    id: r.id,
    title: r.title,
    url: r.url,
    description: r.description,
    icon: r.icon,
    category: r.category,
    isActive: r.is_active === 1,
    sortOrder: r.sort_order,
    createdAt: toIso(r.created_at),
    updatedAt: toIso(r.updated_at),
  }
}

/* ---------------- Profile ---------------- */

export async function getProfile(db: D1Database): Promise<Profile> {
  const row = await db.prepare('SELECT * FROM profiles WHERE id = 1').first<ProfileRow>()
  if (!row) throw new HttpError(500, 'Profile row missing — run the D1 migrations')
  return toProfile(row)
}

export async function updateProfile(db: D1Database, input: ProfileInput): Promise<Profile> {
  await db
    .prepare(
      `UPDATE profiles SET username = ?, display_name = ?, bio = ?, theme_mode = ?, accent_color = ?,
         background_light = ?, background_dark = ?, button_style = ?, grain = ?, socials = ?, updated_at = datetime('now')
       WHERE id = 1`,
    )
    .bind(
      input.username,
      input.displayName,
      input.bio,
      input.themeMode,
      input.accentColor,
      input.backgroundLight,
      input.backgroundDark,
      input.buttonStyle,
      input.grain,
      JSON.stringify(input.socials),
    )
    .run()
  return getProfile(db)
}

const IMAGE_COLUMN: Record<ProfileImageKind, 'avatar_key' | 'background_key'> = {
  avatar: 'avatar_key',
  background: 'background_key',
}

export async function getImageKey(db: D1Database, kind: ProfileImageKind): Promise<string | null> {
  const col = IMAGE_COLUMN[kind]
  const row = await db.prepare(`SELECT ${col} AS k FROM profiles WHERE id = 1`).first<{ k: string | null }>()
  return row?.k ?? null
}

export async function setImageKey(db: D1Database, kind: ProfileImageKind, key: string | null): Promise<void> {
  const col = IMAGE_COLUMN[kind] // whitelisted column name, never user input
  await db.prepare(`UPDATE profiles SET ${col} = ?, updated_at = datetime('now') WHERE id = 1`).bind(key).run()
}

/* ---------------- Links ---------------- */

export async function listLinks(db: D1Database): Promise<Link[]> {
  const { results } = await db.prepare('SELECT * FROM links ORDER BY sort_order, id').all<LinkRow>()
  return results.map(toLink)
}

export async function listPublicLinks(db: D1Database): Promise<PublicLink[]> {
  const { results } = await db
    .prepare('SELECT id, title, url, description, icon, category FROM links WHERE is_active = 1 ORDER BY sort_order, id')
    .all<PublicLink>()
  return results
}

export async function getLink(db: D1Database, id: number): Promise<Link | null> {
  const row = await db.prepare('SELECT * FROM links WHERE id = ?').bind(id).first<LinkRow>()
  return row ? toLink(row) : null
}

export async function getActiveLinkUrl(db: D1Database, id: number): Promise<string | null> {
  const row = await db.prepare('SELECT url FROM links WHERE id = ? AND is_active = 1').bind(id).first<{ url: string }>()
  return row?.url ?? null
}

export async function createLink(db: D1Database, input: LinkInput): Promise<Link> {
  const count = await db.prepare('SELECT COUNT(*) AS n FROM links').first<{ n: number }>()
  if ((count?.n ?? 0) >= LIMITS.links) throw new HttpError(409, `You can have at most ${LIMITS.links} links`)
  const row = await db
    .prepare(
      `INSERT INTO links (title, url, description, icon, category, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM links))
       RETURNING *`,
    )
    .bind(input.title, input.url, input.description, input.icon, input.category, input.isActive ? 1 : 0)
    .first<LinkRow>()
  return toLink(row!)
}

export async function updateLink(db: D1Database, id: number, input: LinkInput): Promise<Link | null> {
  const row = await db
    .prepare(
      `UPDATE links SET title = ?, url = ?, description = ?, icon = ?, category = ?, is_active = ?, updated_at = datetime('now')
       WHERE id = ? RETURNING *`,
    )
    .bind(input.title, input.url, input.description, input.icon, input.category, input.isActive ? 1 : 0, id)
    .first<LinkRow>()
  return row ? toLink(row) : null
}

export async function deleteLink(db: D1Database, id: number): Promise<boolean> {
  const res = await db.prepare('DELETE FROM links WHERE id = ?').bind(id).run()
  return res.meta.changes > 0
}

/** Apply a full ordering. `ids` must contain every link exactly once. */
export async function reorderLinks(db: D1Database, ids: number[]): Promise<Link[]> {
  const { results } = await db.prepare('SELECT id FROM links').all<{ id: number }>()
  const existing = new Set(results.map((r) => r.id))
  const unique = new Set(ids)
  if (unique.size !== ids.length || ids.length !== existing.size || !ids.every((id) => existing.has(id)))
    throw new HttpError(400, 'Order must include every link exactly once')
  if (ids.length) {
    const stmt = db.prepare('UPDATE links SET sort_order = ? WHERE id = ?')
    await db.batch(ids.map((id, i) => stmt.bind(i, id)))
  }
  return listLinks(db)
}
