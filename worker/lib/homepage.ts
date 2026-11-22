/**
 * D1 access for homepage sections (draft / publish). All statements use bound parameters;
 * table and column names come only from the constants below, never from user input.
 *
 * Each table holds a 'draft' and a 'published' copy (see migrations/0002 and 0004). Editing writes
 * the draft. Publishing copies every draft table over its published copy in one atomic batch.
 *
 * homepage_experience and homepage_opportunities (pass 1) are no longer read or written. They are
 * kept in the database so no data is deleted.
 */
import { emptyHomepage, normalizeSections } from '../../shared/homepage'
import type { HomepageAdminState, HomepageContact, HomepageContent, HomepageIntro, SectionKey, SectionSetting, SkillItem } from '../../shared/types'
import { HttpError } from './http'

type State = 'draft' | 'published'

interface IntroRow {
  headline: string
  about: string
}
interface ContactRow {
  email: string
  location: string
  portfolio_url: string
  portfolio_coming_soon: number
}

const toIso = (sqlTime: string) => `${sqlTime.replace(' ', 'T')}Z`

/** Read one full copy of the homepage. Returns null for 'published' when nothing has been published. */
export async function readHomepage(db: D1Database, state: State): Promise<HomepageContent | null> {
  const [intro, contact, skills, openTo, sections] = await db.batch([
    db.prepare('SELECT headline, about FROM homepage_intro WHERE state = ?').bind(state),
    db.prepare('SELECT email, location, portfolio_url, portfolio_coming_soon FROM homepage_contact WHERE state = ?').bind(state),
    db.prepare('SELECT label FROM homepage_skills WHERE state = ? ORDER BY sort_order, id').bind(state),
    db.prepare('SELECT sentence FROM homepage_open_to WHERE state = ?').bind(state),
    db.prepare('SELECT section_key, is_visible FROM homepage_sections WHERE state = ? ORDER BY sort_order').bind(state),
  ])
  const sectionRows = sections.results as { section_key: SectionKey; is_visible: number }[]
  if (state === 'published' && sectionRows.length === 0) return null

  const base = emptyHomepage()
  const i = (intro.results as unknown as IntroRow[])[0]
  const c = (contact.results as unknown as ContactRow[])[0]
  const o = (openTo.results as { sentence: string }[])[0]
  return {
    intro: i ? { headline: i.headline, about: i.about } : base.intro,
    contact: c
      ? { email: c.email, location: c.location, portfolioUrl: c.portfolio_url, portfolioComingSoon: c.portfolio_coming_soon === 1 }
      : base.contact,
    skills: skills.results as unknown as SkillItem[],
    openTo: o?.sentence ?? '',
    sections: normalizeSections(sectionRows.map((r) => ({ key: r.section_key, visible: r.is_visible === 1 }))),
  }
}

export async function getHomepageAdminState(db: D1Database): Promise<HomepageAdminState> {
  const [draft, published, meta] = await Promise.all([
    readHomepage(db, 'draft'),
    readHomepage(db, 'published'),
    // Publishing stamps updated_at on every published singleton row.
    db.prepare("SELECT updated_at AS t FROM homepage_intro WHERE state = 'published'").first<{ t: string }>(),
  ])
  const d = draft ?? emptyHomepage()
  return {
    draft: d,
    published,
    publishedAt: published && meta ? toIso(meta.t) : null,
    hasUnpublishedChanges: !published || JSON.stringify(published) !== JSON.stringify(d),
  }
}

/* ---------------- Draft writes ---------------- */

export async function saveIntroDraft(db: D1Database, v: HomepageIntro): Promise<void> {
  await db
    .prepare(
      `INSERT INTO homepage_intro (state, headline, about, updated_at) VALUES ('draft', ?, ?, datetime('now'))
       ON CONFLICT (state) DO UPDATE SET headline = excluded.headline, about = excluded.about, updated_at = excluded.updated_at`,
    )
    .bind(v.headline, v.about)
    .run()
}

export async function saveContactDraft(db: D1Database, v: HomepageContact): Promise<void> {
  await db
    .prepare(
      `INSERT INTO homepage_contact (state, email, location, portfolio_url, portfolio_coming_soon, updated_at)
       VALUES ('draft', ?, ?, ?, ?, datetime('now'))
       ON CONFLICT (state) DO UPDATE SET email = excluded.email, location = excluded.location,
         portfolio_url = excluded.portfolio_url, portfolio_coming_soon = excluded.portfolio_coming_soon, updated_at = excluded.updated_at`,
    )
    .bind(v.email, v.location, v.portfolioUrl, v.portfolioComingSoon ? 1 : 0)
    .run()
}

export async function saveOpenToDraft(db: D1Database, sentence: string): Promise<void> {
  await db
    .prepare(
      `INSERT INTO homepage_open_to (state, sentence, updated_at) VALUES ('draft', ?, datetime('now'))
       ON CONFLICT (state) DO UPDATE SET sentence = excluded.sentence, updated_at = excluded.updated_at`,
    )
    .bind(sentence)
    .run()
}

export async function saveSkillsDraft(db: D1Database, items: SkillItem[]): Promise<void> {
  const insert = db.prepare("INSERT INTO homepage_skills (state, label, sort_order) VALUES ('draft', ?, ?)")
  await db.batch([db.prepare("DELETE FROM homepage_skills WHERE state = 'draft'"), ...items.map((s, i) => insert.bind(s.label, i))])
}

export async function saveSectionsDraft(db: D1Database, items: SectionSetting[]): Promise<void> {
  const insert = db.prepare("INSERT INTO homepage_sections (state, section_key, is_visible, sort_order) VALUES ('draft', ?, ?, ?)")
  await db.batch([
    db.prepare("DELETE FROM homepage_sections WHERE state = 'draft'"),
    ...items.map((s, i) => insert.bind(s.key, s.visible ? 1 : 0, i)),
  ])
}

/* ---------------- Publish / discard ---------------- */

/**
 * Singleton tables and the columns copied on publish. UPDATE-in-place (not REPLACE) so columns the
 * app no longer uses keep whatever they held.
 */
const SINGLETONS = {
  homepage_intro: ['headline', 'about'],
  homepage_contact: ['email', 'location', 'portfolio_url', 'portfolio_coming_soon'],
  homepage_open_to: ['sentence'],
} as const

const LISTS = {
  homepage_skills: ['label', 'sort_order'],
  homepage_sections: ['section_key', 'is_visible', 'sort_order'],
} as const

/** Statements that make the `to` copy identical to the `from` copy, for every homepage table in use. */
function copyStatements(db: D1Database, from: State, to: State): D1PreparedStatement[] {
  const stmts: D1PreparedStatement[] = []
  for (const [table, cols] of Object.entries(SINGLETONS)) {
    const c = cols.join(', ')
    const updates = cols.map((col) => `${col} = excluded.${col}`).join(', ')
    stmts.push(
      db
        .prepare(
          `INSERT INTO ${table} (state, ${c}, updated_at) SELECT ?, ${c}, datetime('now') FROM ${table} WHERE state = ?
           ON CONFLICT (state) DO UPDATE SET ${updates}, updated_at = excluded.updated_at`,
        )
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
