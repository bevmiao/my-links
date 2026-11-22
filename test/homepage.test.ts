import { env } from 'cloudflare:workers'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { HomepageAdminState, PublicPageData } from '../shared/types'
import { adminCall, call, createSigner, mockAccessCerts, PUBLIC, validClaims } from './helpers'

let token: string
let restoreFetch: () => void

beforeAll(async () => {
  const signer = await createSigner()
  token = await signer.sign(validClaims())
  restoreFetch = mockAccessCerts([signer.jwk]).mockRestore
})
afterAll(() => restoreFetch())

const getState = async () => (await (await adminCall(token, '/api/admin/homepage')).json()) as HomepageAdminState
const publicData = async () => (await (await call(`${PUBLIC}/api/profile`)).json()) as PublicPageData
const put = (section: string, json: unknown) => adminCall(token, `/api/admin/homepage/${section}`, { method: 'PUT', json })
/** Sections with stored settings from earlier migrations, in their stored order. */
const STORED_KEYS = ['intro', 'story', 'skills', 'opportunities', 'contact', 'testimonials']
/** Every section. 'videos' (0007) and 'clients' (0008) have no stored row yet, so they are added at the end, hidden. */
const ALL_KEYS = [...STORED_KEYS, 'videos', 'clients']

// Tests in this file run in order and share one isolated database.
describe('homepage draft / publish', () => {
  it('starts with placeholder drafts and nothing published', async () => {
    const s = await getState()
    expect(s.published).toBeNull()
    expect(s.publishedAt).toBeNull()
    expect(s.hasUnpublishedChanges).toBe(true)
    expect(s.draft.intro.headline).toBeTruthy()
    expect(s.draft.intro.about).toMatch(/^I shoot photos and video/) // refreshed by migration 0004
    expect(s.draft.openTo).toBe('Always up for freelance shoots, collabs, or just a coffee. Say hi!')
    expect(s.draft.skills.length).toBeGreaterThan(0)
    expect(s.draft.story).toMatchObject({ title: 'Where I grew up', body: expect.stringMatching(/^Placeholder/) })
    // Experience was removed; its stored section row is ignored.
    expect(s.draft.sections.map((x) => x.key)).toEqual(ALL_KEYS)
    expect(s.draft.sections.find((x) => x.key === 'videos')?.visible).toBe(false)
    expect(s.draft.videos).toEqual([])

    // Placeholder drafts are not public.
    expect((await publicData()).homepage).toBeNull()
    const html = await (await call(`${PUBLIC}/`)).text()
    expect(html).not.toContain(s.draft.intro.headline)
  })

  it('validates each section on the server', async () => {
    const bad = await put('contact', { email: 'not-an-email', portfolioUrl: 'javascript:alert(1)', portfolioComingSoon: 'yes' })
    expect(bad.status).toBe(422)
    const { fields } = (await bad.json()) as { fields: Record<string, string> }
    expect(Object.keys(fields).sort()).toEqual(['email', 'portfolioComingSoon', 'portfolioUrl'])

    expect((await put('skills', { items: [{ label: '' }] })).status).toBe(422)
    expect((await put('open-to', { sentence: 'x'.repeat(201) })).status).toBe(422)
    expect((await put('intro', { headline: 'x'.repeat(121), about: '' })).status).toBe(422)
    expect((await put('story', { title: 't', body: 'x'.repeat(2001) })).status).toBe(422)
    expect((await put('sections', { items: [{ key: 'intro', visible: true }] })).status).toBe(422) // must list every section
    expect((await put('sections', { items: [...ALL_KEYS, 'experience'].map((key) => ({ key, visible: true })) })).status).toBe(422)
    expect((await put('experience', { items: [] })).status).toBe(404) // removed section
    expect((await put('videos', { items: [{ videoId: 'not-an-id', title: 'x' }] })).status).toBe(422)
    expect((await put('videos', { items: [{ videoId: 'dQw4w9WgXcQ', title: '' }] })).status).toBe(422) // title required
    expect((await put('videos', { items: [{ videoId: '"><script>x', title: 'x' }] })).status).toBe(422)
    expect((await put('videos', { items: Array.from({ length: 13 }, () => ({ videoId: 'dQw4w9WgXcQ', title: 'x' })) })).status).toBe(422)
    expect((await put('constructor', {})).status).toBe(404) // no prototype lookups
    expect((await put('toString', {})).status).toBe(404)
  })

  it('blocks cross-origin writes and the public host entirely', async () => {
    const csrf = await adminCall(token, '/api/admin/homepage/publish', { method: 'POST', headers: { Origin: 'https://evil.example' } })
    expect(csrf.status).toBe(403)
    expect((await call(`${PUBLIC}/api/admin/homepage`)).status).toBe(404)
  })

  it('saves drafts without touching the public site, then publishes them', async () => {
    const intro = { headline: 'Draft headline', about: 'Hey, I take pictures.' }
    const res = await put('intro', intro)
    expect(res.status).toBe(200)
    expect(((await res.json()) as HomepageAdminState).draft.intro).toEqual(intro)

    await put('contact', {
      email: 'me@example.com',
      location: 'Pasadena',
      portfolioUrl: 'https://example.com/secret-placeholder',
      portfolioComingSoon: true,
    })
    await put('skills', { items: [{ label: 'Photography' }, { label: 'Editing' }] })
    await put('open-to', { sentence: 'Up for coffee.' })
    await put('story', { title: 'Where I grew up', body: 'Alhambra summers.' })
    expect((await publicData()).homepage).toBeNull() // still unpublished

    const pub = await adminCall(token, '/api/admin/homepage/publish', { method: 'POST' })
    expect(pub.status).toBe(200)
    const state = (await pub.json()) as HomepageAdminState
    expect(state.hasUnpublishedChanges).toBe(false)
    expect(state.publishedAt).toMatch(/Z$/)

    const home = (await publicData()).homepage!
    expect(home.sections.map((s) => s.key)).toEqual(STORED_KEYS) // videos: hidden and empty
    expect(home.sections.find((s) => s.key === 'intro')).toEqual({ key: 'intro', intro })
    expect(home.sections.find((s) => s.key === 'opportunities')).toEqual({ key: 'opportunities', sentence: 'Up for coffee.' })
    expect(home.sections.find((s) => s.key === 'contact')).toEqual({
      key: 'contact',
      contact: { email: 'me@example.com', location: 'Pasadena', portfolioUrl: '', portfolioComingSoon: true }, // coming-soon URL hidden
      story: { title: 'Where I grew up', body: 'Alhambra summers.' }, // for the location pop-up
    })
    expect(home.sections.find((s) => s.key === 'story')).toEqual({ key: 'story', story: { title: 'Where I grew up', body: 'Alhambra summers.' } })
    expect(JSON.stringify(home)).not.toContain('secret-placeholder')
    expect(home.sections.find((s) => s.key === 'skills')).toEqual({ key: 'skills', items: [{ label: 'Photography' }, { label: 'Editing' }] })
  })

  it('keeps later draft edits private until the next publish', async () => {
    await put('intro', { headline: 'Unpublished idea', about: '' })
    const s = await getState()
    expect(s.hasUnpublishedChanges).toBe(true)
    expect(JSON.stringify(await publicData())).not.toContain('Unpublished idea')
    expect(await (await call(`${PUBLIC}/`)).text()).not.toContain('Unpublished idea')
  })

  it('discards the draft back to the published version', async () => {
    const res = await adminCall(token, '/api/admin/homepage/discard', { method: 'POST' })
    expect(res.status).toBe(200)
    const s = (await res.json()) as HomepageAdminState
    expect(s.draft.intro.headline).toBe('Draft headline')
    expect(s.hasUnpublishedChanges).toBe(false)
  })

  it('omits hidden sections from the public data completely', async () => {
    const order = ['contact', 'intro', 'story', 'skills', 'opportunities', 'testimonials', 'videos', 'clients']
    await put('sections', { items: order.map((key) => ({ key, visible: key !== 'skills' && key !== 'story' && key !== 'videos' && key !== 'clients' })) })
    await adminCall(token, '/api/admin/homepage/publish', { method: 'POST' })
    const home = (await publicData()).homepage!
    expect(home.sections.map((s) => s.key)).toEqual(['contact', 'intro', 'opportunities', 'testimonials'])
    expect(JSON.stringify(home)).not.toContain('Photography')
    // A hidden story must not leak through the location pop-up either.
    expect(home.sections.find((s) => s.key === 'contact')).toMatchObject({ story: null })
    expect(JSON.stringify(home)).not.toContain('Alhambra')
  })

  it('adds YouTube videos as a Work section, private until published', async () => {
    const videos = [
      { videoId: 'dQw4w9WgXcQ', title: 'Golden hour in Pasadena' },
      { videoId: 'aqz-KE-bpKQ', title: 'Wedding highlights' },
    ]
    const saved = await put('videos', { items: videos })
    expect(saved.status).toBe(200)
    expect(((await saved.json()) as HomepageAdminState).draft.videos).toEqual(videos)
    const order = ['contact', 'intro', 'story', 'skills', 'opportunities', 'videos', 'testimonials', 'clients']
    await put('sections', { items: order.map((key) => ({ key, visible: key !== 'skills' && key !== 'story' && key !== 'clients' })) })
    expect(JSON.stringify(await publicData())).not.toContain('dQw4w9WgXcQ') // draft only

    await adminCall(token, '/api/admin/homepage/publish', { method: 'POST' })
    const home = (await publicData()).homepage!
    expect(home.sections.map((s) => s.key)).toEqual(['contact', 'intro', 'opportunities', 'videos', 'testimonials'])
    expect(home.sections.find((s) => s.key === 'videos')).toEqual({ key: 'videos', items: videos })

    // Hiding the section removes the videos from the public data entirely.
    await put('sections', { items: order.map((key) => ({ key, visible: key !== 'videos' && key !== 'clients' })) })
    await adminCall(token, '/api/admin/homepage/publish', { method: 'POST' })
    expect(JSON.stringify(await publicData())).not.toContain('dQw4w9WgXcQ')
  })

  it('publishes atomically: every table in use matches the draft afterwards', async () => {
    const rows = async (sql: string, state: string) => (await env.DB.prepare(sql).bind(state).all()).results
    const queries = [
      'SELECT headline, about FROM homepage_intro WHERE state = ?',
      'SELECT email, location, portfolio_url, portfolio_coming_soon FROM homepage_contact WHERE state = ?',
      'SELECT sentence FROM homepage_open_to WHERE state = ?',
      'SELECT title, body FROM homepage_story WHERE state = ?',
      'SELECT label, sort_order FROM homepage_skills WHERE state = ? ORDER BY sort_order',
      'SELECT video_id, title, sort_order FROM homepage_videos WHERE state = ? ORDER BY sort_order',
      'SELECT name, logo_key, sort_order FROM homepage_clients WHERE state = ? ORDER BY sort_order',
      'SELECT section_key, is_visible, sort_order FROM homepage_section_settings WHERE state = ? ORDER BY sort_order',
    ]
    for (const q of queries) expect(await rows(q, 'published')).toEqual(await rows(q, 'draft'))
  })

  it('never deletes the retired pass-1 data', async () => {
    const n = async (table: string) => (await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${table}`).first<{ n: number }>())!.n
    expect(await n('homepage_experience')).toBeGreaterThan(0)
    expect(await n('homepage_opportunities')).toBeGreaterThan(0)
    expect(await n('homepage_sections')).toBeGreaterThan(0)
  })
})

describe('public pages', () => {
  it('serves /about and /work with embedded data, per-page titles and canonical URLs', async () => {
    for (const [path, label] of [['/about', 'About'], ['/work', 'Work']]) {
      const res = await call(`${PUBLIC}${path}`)
      expect(res.status).toBe(200)
      const html = await res.text()
      expect(html).toContain('<script type="application/json" id="initial-data">')
      expect(html).toMatch(new RegExp(`<title>${label} · `))
      expect(html).toContain(`<link rel="canonical" href="${PUBLIC}${path}" />`)
      const csp = res.headers.get('Content-Security-Policy') ?? ''
      expect(csp).toContain("script-src 'self'")
      // Only the privacy-enhanced YouTube player may be framed; thumbnails only from i.ytimg.com.
      expect(csp).toContain('frame-src https://www.youtube-nocookie.com;')
      expect(csp).toContain("img-src 'self' data: blob: https://i.ytimg.com;")
      expect(csp).toContain("frame-ancestors 'none'")
    }
    expect(await (await call(`${PUBLIC}/`)).text()).toContain(`<link rel="canonical" href="${PUBLIC}/" />`)
  })

  it('keeps admin paths off the public host', async () => {
    expect((await call(`${PUBLIC}/admin/homepage`)).status).toBe(404)
  })
})
