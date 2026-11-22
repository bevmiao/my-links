/**
 * D1 access for homepage sections (draft / publish). All statements use bound parameters;
 * table and column names come only from the constants below, never from user input.
 *
 * Each table holds a 'draft' and a 'published' copy (see migrations/0002). Editing writes the
 * draft. Publishing copies every draft table over its published copy in one atomic batch.
 */
import { emptyHomepage, normalizeSections } from '../../shared/homepage'
import type {
  ExperienceItem,
  HomepageAdminState,
  HomepageContact,
  HomepageContent,
  HomepageIntro,
  OpportunityItem,
  SectionKey,
  SectionSetting,
  SkillItem,
} from '../../shared/types'
import { HttpError } from './http'

type State = 'draft' | 'published'

interface IntroRow {
  headline: string
  intro: string
  about: string
  background: string
  interests: string
  updated_at: string
}
interface ContactRow {
  email: string
  phone: string
  location: string
  linkedin_url: string
  resume_url: string
  portfolio_url: string
  portfolio_coming_soon: number
}

function parseStringArray(raw: string): string[] {
  try {
    const v = JSON.parse(raw)
    return Array.isArray(v) ? v.filter((s): s is string => typeof s === 'string') : []
  } catch {
    return []
  }
}

const toIso = (sqlTime: string) => `${sqlTime.replace(' ', 'T')}Z`

/** Read one full copy of the homepage. Returns null when that copy has never been written. */
export async function readHomepage(db: D1Database, state: State): Promise<HomepageContent | null> {
  const [intro, contact, skills, experience, opportunities, sections] = await db.batch([
    db.prepare('SELECT * FROM homepage_intro WHERE state = ?').bind(state),
    db.prepare('SELECT * FROM homepage_contact WHERE state = ?').bind(state),
    db.prepare('SELECT label FROM homepage_skills WHERE state = ? ORDER BY sort_order, id').bind(state),
    db.prepare('SELECT role, organization, period, description FROM homepage_experience WHERE state = ? ORDER BY sort_order, id').bind(state),
    db.prepare('SELECT title, description FROM homepage_opportunities WHERE state = ? ORDER BY sort_order, id').bind(state),
    db.prepare('SELECT section_key, is_visible FROM homepage_sections WHERE state = ? ORDER BY sort_order').bind(state),
  ])
  const sectionRows = sections.results as { section_key: SectionKey; is_visible: number }[]
  if (state === 'published' && sectionRows.length === 0) return null

  const base = emptyHomepage()
  const i = (intro.results as unknown as IntroRow[])[0]
  const c = (contact.results as unknown as ContactRow[])[0]
  return {
    intro: i
      ? { headline: i.headline, intro: i.intro, about: i.about, background: i.background, interests: parseStringArray(i.interests) }
      : base.intro,
    contact: c
      ? {
          email: c.email,
          phone: c.phone,
          location: c.location,
          linkedinUrl: c.linkedin_url,
          resumeUrl: c.resume_url,
          portfolioUrl: c.portfolio_url,
          portfolioComingSoon: c.portfolio_coming_soon === 1,
        }
      : base.contact,
    skills: skills.results as unknown as SkillItem[],
    experience: experience.results as unknown as ExperienceItem[],
    opportunities: opportunities.results as unknown as OpportunityItem[],
    sections: normalizeSections(sectionRows.map((r) => ({ key: r.section_key, visible: r.is_visible === 1 }))),
  }
}

export async function getHomepageAdminState(db: D1Database): Promise<HomepageAdminState> {
  const [draft, published, meta] = await Promise.all([
    readHomepage(db, 'draft'),
    readHomepage(db, 'published'),
    db.prepare("SELECT updated_at FROM homepage_intro WHERE state = 'published'").first<{ updated_at: string }>(),
  ])
  const d = draft ?? emptyHomepage()
  return {
    draft: d,
    published,
    publishedAt: published && meta ? toIso(meta.updated_at) : null,
    hasUnpublishedChanges: !published || JSON.stringify(published) !== JSON.stringify(d),
  }
}

/* ---------------- Draft writes ---------------- */

export async function saveIntroDraft(db: D1Database, v: HomepageIntro): Promise<void> {
  await db
    .prepare(
      `INSERT INTO homepage_intro (state, headline, intro, about, background, interests, updated_at)
       VALUES ('draft', ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (state) DO UPDATE SET headline = excluded.headline, intro = excluded.intro, about = excluded.about,
         background = excluded.background, interests = excluded.interests, updated_at = excluded.updated_at`,
    )
    .bind(v.headline, v.intro, v.about, v.background, JSON.stringify(v.interests))
    .run()
}

export async function saveContactDraft(db: D1Database, v: HomepageContact): Promise<void> {
  await db
    .prepare(
      `INSERT INTO homepage_contact (state, email, phone, location, linkedin_url, resume_url, portfolio_url, portfolio_coming_soon, updated_at)
       VALUES ('draft', ?, ?, ?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (state) DO UPDATE SET email = excluded.email, phone = excluded.phone, location = excluded.location,
         linkedin_url = excluded.linkedin_url, resume_url = excluded.resume_url, portfolio_url = excluded.portfolio_url,
         portfolio_coming_soon = excluded.portfolio_coming_soon, updated_at = excluded.updated_at`,
    )
    .bind(v.email, v.phone, v.location, v.linkedinUrl, v.resumeUrl, v.portfolioUrl, v.portfolioComingSoon ? 1 : 0)
    .run()
}

/** Replace the draft rows of a list section with `items`, in order, atomically. */
async function replaceDraftList(db: D1Database, table: string, columns: string[], rows: unknown[][]): Promise<void> {
  const placeholders = columns.map(() => '?').join(', ')
  const insert = db.prepare(`INSERT INTO ${table} (state, ${columns.join(', ')}, sort_order) VALUES ('draft', ${placeholders}, ?)`)
  await db.batch([
    db.prepare(`DELETE FROM ${table} WHERE state = 'draft'`),
    ...rows.map((values, i) => insert.bind(...values, i)),
  ])
}

export const saveSkillsDraft = (db: D1Database, items: SkillItem[]) =>
  replaceDraftList(db, 'homepage_skills', ['label'], items.map((s) => [s.label]))

export const saveExperienceDraft = (db: D1Database, items: ExperienceItem[]) =>
  replaceDraftList(
    db,
    'homepage_experience',
    ['role', 'organization', 'period', 'description'],
    items.map((e) => [e.role, e.organization, e.period, e.description]),
  )

export const saveOpportunitiesDraft = (db: D1Database, items: OpportunityItem[]) =>
  replaceDraftList(db, 'homepage_opportunities', ['title', 'description'], items.map((o) => [o.title, o.description]))

export async function saveSectionsDraft(db: D1Database, items: SectionSetting[]): Promise<void> {
  const insert = db.prepare("INSERT INTO homepage_sections (state, section_key, is_visible, sort_order) VALUES ('draft', ?, ?, ?)")
  await db.batch([
    db.prepare("DELETE FROM homepage_sections WHERE state = 'draft'"),
    ...items.map((s, i) => insert.bind(s.key, s.visible ? 1 : 0, i)),
  ])
}

/* ---------------- Publish / discard ---------------- */

const SINGLETONS = {
  homepage_intro: ['headline', 'intro', 'about', 'background', 'interests'],
  homepage_contact: ['email', 'phone', 'location', 'linkedin_url', 'resume_url', 'portfolio_url', 'portfolio_coming_soon'],
} as const

const LISTS = {
  homepage_skills: ['label', 'sort_order'],
  homepage_experience: ['role', 'organization', 'period', 'description', 'sort_order'],
  homepage_opportunities: ['title', 'description', 'sort_order'],
  homepage_sections: ['section_key', 'is_visible', 'sort_order'],
} as const

/** Statements that make the `to` copy identical to the `from` copy, for every homepage table. */
function copyStatements(db: D1Database, from: State, to: State): D1PreparedStatement[] {
  const stmts: D1PreparedStatement[] = []
  for (const [table, cols] of Object.entries(SINGLETONS)) {
    const c = cols.join(', ')
    stmts.push(
      db
        .prepare(`INSERT OR REPLACE INTO ${table} (state, ${c}, updated_at) SELECT ?, ${c}, datetime('now') FROM ${table} WHERE state = ?`)
        .bind(to, from),
    )
  }
  for (const [table, cols] of Object.entries(LISTS)) {
    const c = cols.join(', ')
    stmts.push(db.prepare(`DELETE FROM ${table} WHERE state = ?`).bind(to))
    stmts.push(db.prepare(`INSERT INTO ${table} (state, ${c}) SELECT ?, ${c} FROM ${table} WHERE state = ?`).bind(to, from))
  }
  return stmts
}

/** Make the current draft public. One D1 batch, so visitors never see a half-published page. */
export async function publishHomepage(db: D1Database): Promise<void> {
  const draftSections = await db.prepare("SELECT COUNT(*) AS n FROM homepage_sections WHERE state = 'draft'").first<{ n: number }>()
  if (!draftSections?.n) throw new HttpError(409, 'There is no draft to publish yet')
  await db.batch(copyStatements(db, 'draft', 'published'))
}

/** Throw away unpublished edits by copying the published version back into the draft. */
export async function discardHomepageDraft(db: D1Database): Promise<void> {
  const published = await db.prepare("SELECT COUNT(*) AS n FROM homepage_sections WHERE state = 'published'").first<{ n: number }>()
  if (!published?.n) throw new HttpError(409, 'Nothing has been published yet, so there is nothing to go back to')
  await db.batch(copyStatements(db, 'published', 'draft'))
}
