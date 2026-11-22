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

// Tests in this file run in order and share one isolated database.
describe('homepage draft / publish', () => {
  it('starts with placeholder drafts and nothing published', async () => {
    const s = await getState()
    expect(s.published).toBeNull()
    expect(s.publishedAt).toBeNull()
    expect(s.hasUnpublishedChanges).toBe(true)
    expect(s.draft.intro.headline).toBeTruthy()
    expect(s.draft.opportunities.map((o) => o.title)).toEqual([
      'Employment',
      'Collaborations',
      'Networking',
      'Freelance',
      'Business',
      'Creative partnerships',
    ])
    expect(s.draft.sections.map((x) => x.key)).toEqual(['intro', 'experience', 'skills', 'opportunities', 'contact', 'testimonials'])

    // Placeholder drafts are not public.
    expect((await publicData()).homepage).toBeNull()
    const html = await (await call(`${PUBLIC}/`)).text()
    expect(html).not.toContain(s.draft.intro.headline)
  })

  it('validates each section on the server', async () => {
    const bad = await put('contact', { email: 'not-an-email', linkedinUrl: 'javascript:alert(1)', resumeUrl: 'mailto:a@b.co', phone: '<b>' })
    expect(bad.status).toBe(422)
    const { fields } = (await bad.json()) as { fields: Record<string, string> }
    expect(Object.keys(fields).sort()).toEqual(['email', 'linkedinUrl', 'phone', 'resumeUrl'])

    expect((await put('skills', { items: [{ label: '' }] })).status).toBe(422)
    expect((await put('experience', { items: [{ role: 'x'.repeat(500) }] })).status).toBe(422)
    expect((await put('sections', { items: [{ key: 'intro', visible: true }] })).status).toBe(422) // must list every section
    expect((await put('sections', { items: [{ key: 'admin', visible: true }] })).status).toBe(422)
    expect((await put('unknown', {})).status).toBe(404)
  })

  it('blocks cross-origin writes and the public host entirely', async () => {
    const csrf = await adminCall(token, '/api/admin/homepage/publish', { method: 'POST', headers: { Origin: 'https://evil.example' } })
    expect(csrf.status).toBe(403)
    expect((await call(`${PUBLIC}/api/admin/homepage`)).status).toBe(404)
  })

  it('saves drafts without touching the public site, then publishes them', async () => {
    const intro = { headline: 'Draft headline', intro: 'Hi there.', about: 'About me.', background: 'Background.', interests: ['Film', ' '] }
    const res = await put('intro', intro)
    expect(res.status).toBe(200)
    const saved = (await res.json()) as HomepageAdminState
    expect(saved.draft.intro).toEqual({ ...intro, interests: ['Film'] }) // blank interests dropped

    await put('contact', {
      email: 'me@example.com',
      phone: '+1 (626) 555-0100',
      location: 'Pasadena',
      linkedinUrl: 'linkedin.com/in/me',
      resumeUrl: 'https://drive.google.com/file/d/abc/view',
      portfolioUrl: 'https://example.com/secret-placeholder',
      portfolioComingSoon: true,
    })
    await put('skills', { items: [{ label: 'Photography' }, { label: 'Editing' }] })
    expect((await publicData()).homepage).toBeNull() // still unpublished

    const pub = await adminCall(token, '/api/admin/homepage/publish', { method: 'POST' })
    expect(pub.status).toBe(200)
    const state = (await pub.json()) as HomepageAdminState
    expect(state.hasUnpublishedChanges).toBe(false)
    expect(state.publishedAt).toMatch(/Z$/)

    const home = (await publicData()).homepage!
    const intoSection = home.sections.find((s) => s.key === 'intro')
    expect(intoSection).toEqual({ key: 'intro', intro: { ...intro, interests: ['Film'] } })
    const contact = home.sections.find((s) => s.key === 'contact')
    expect(contact).toMatchObject({ contact: { linkedinUrl: 'https://linkedin.com/in/me', portfolioUrl: '' } }) // coming-soon URL hidden
    expect(JSON.stringify(home)).not.toContain('secret-placeholder')
    expect(home.sections.find((s) => s.key === 'skills')).toEqual({ key: 'skills', items: [{ label: 'Photography' }, { label: 'Editing' }] })
  })

  it('keeps later draft edits private until the next publish', async () => {
    await put('intro', { headline: 'Unpublished idea', intro: '', about: '', background: '', interests: [] })
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
    const order = ['contact', 'intro', 'experience', 'skills', 'opportunities', 'testimonials']
    await put('sections', { items: order.map((key) => ({ key, visible: key !== 'skills' })) })
    await adminCall(token, '/api/admin/homepage/publish', { method: 'POST' })
    const home = (await publicData()).homepage!
    expect(home.sections.map((s) => s.key)).toEqual(['contact', 'intro', 'experience', 'opportunities', 'testimonials'])
    expect(JSON.stringify(home)).not.toContain('Photography')
  })

  it('publishes atomically: every table matches the draft afterwards', async () => {
    const rows = async (table: string, state: string) =>
      (await env.DB.prepare(`SELECT * FROM ${table} WHERE state = ? ORDER BY sort_order`).bind(state).all()).results.map((row) => {
        const rest: Record<string, unknown> = { ...row }
        delete rest.id
        delete rest.state
        return rest
      })
    for (const table of ['homepage_skills', 'homepage_experience', 'homepage_opportunities', 'homepage_sections']) {
      expect(await rows(table, 'published')).toEqual(await rows(table, 'draft'))
    }
  })
})
