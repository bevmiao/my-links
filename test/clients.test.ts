import { env } from 'cloudflare:workers'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SECTION_KEYS, type ClientItem, type HomepageAdminState, type PublicClient, type PublicPageData } from '../shared/types'
import { pruneClientMedia } from '../worker/lib/media'
import { adminCall, call, createSigner, eventually, mockAccessCerts, pngBytes, PUBLIC, validClaims } from './helpers'

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
const publish = () => adminCall(token, '/api/admin/homepage/publish', { method: 'POST' })
const showOnly = (visible: string[]) => put('sections', { items: SECTION_KEYS.map((key) => ({ key, visible: visible.includes(key) })) })
const publicClients = async () => {
  const s = (await publicData()).homepage?.sections.find((x) => x.key === 'clients')
  return s && 'items' in s ? (s.items as PublicClient[]) : null
}

function upload(kind: 'client-logo' | 'client-photo', bytes: Uint8Array, name = 'img.png', type = 'image/png') {
  const form = new FormData()
  form.append('file', new File([bytes], name, { type }))
  return adminCall(token, `/api/admin/images/${kind}`, { method: 'POST', body: form })
}
const uploadKey = async (kind: 'client-logo' | 'client-photo') => ((await (await upload(kind, pngBytes())).json()) as { key: string }).key

const gifBytes = () => Uint8Array.from(atob('R0lGODlhAQABAAAAACw='), (c) => c.charCodeAt(0))
const svgBytes = () => new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>')
const client = (over: Partial<ClientItem>): ClientItem => ({ name: 'Acme', logoKey: null, logoMono: true, title: '', bullets: [], images: [], ...over })

// Tests in this file run in order and share one isolated database.
describe('client logo strip', () => {
  it('starts with placeholder clients in the draft only, with the section hidden', async () => {
    const s = await getState()
    expect(s.draft.clients.map((c) => [c.name, c.logoKey, c.logoMono])).toEqual([
      ['Placeholder Studio', 'placeholder/client-1.png', true],
      ['Placeholder Coffee Co.', 'placeholder/client-2.png', true],
      ['Placeholder Records', 'placeholder/client-3.png', true],
      ['Placeholder Outdoors', 'placeholder/client-4.png', true],
      ['Placeholder Agency', null, true],
    ])
    // Migration 0009 gives two placeholders sample details so the pop-up can be tried.
    expect(s.draft.clients[0]).toMatchObject({ title: expect.stringMatching(/^Placeholder/), images: [] })
    expect(s.draft.clients[0].bullets).toHaveLength(3)
    expect(s.draft.clients[1].bullets).toHaveLength(2)
    expect(s.draft.clients[2]).toMatchObject({ title: '', bullets: [], images: [] })
    expect(s.draft.sections.find((x) => x.key === 'clients')).toEqual({ key: 'clients', visible: false })
    expect(s.published).toBeNull()
    expect(JSON.stringify(await publicData())).not.toContain('Placeholder Studio')
  })

  it('uploads logos and photos with the same checks as other images, minus GIF and SVG', async () => {
    for (const [kind, limit] of [['client-logo', 1024 * 1024], ['client-photo', 3 * 1024 * 1024]] as const) {
      const res = await upload(kind, pngBytes())
      expect(res.status).toBe(201)
      const { key, url } = (await res.json()) as { key: string; url: string }
      expect(key).toMatch(new RegExp(`^${kind}/[0-9a-f-]{36}\\.png$`))
      expect(url).toBe(`/media/${key}`)
      const media = await call(`${PUBLIC}${url}`)
      expect(media.status).toBe(200)
      expect(media.headers.get('Content-Type')).toBe('image/png')
      expect(media.headers.get('X-Content-Type-Options')).toBe('nosniff')

      expect((await upload(kind, gifBytes(), 'a.gif', 'image/gif')).status).toBe(415) // real image, not allowed
      expect((await upload(kind, svgBytes(), 'x.svg', 'image/svg+xml')).status).toBe(415)
      expect((await upload(kind, svgBytes(), 'x.png', 'image/png')).status).toBe(415) // disguised
      const big = new Uint8Array(limit + 1)
      big.set(pngBytes())
      expect((await upload(kind, big)).status).toBe(413)
      // Never on the public host.
      expect((await call(`${PUBLIC}/api/admin/images/${kind}`, { method: 'POST' })).status).toBe(404)
    }
  })

  it('validates names, details, and keys, and only accepts uploads that exist', async () => {
    const bad = async (items: unknown[]) => {
      const res = await put('clients', { items })
      expect(res.status).toBe(422)
      return ((await res.json()) as { fields: Record<string, string> }).fields
    }
    const zero = '00000000-0000-0000-0000-000000000000'
    expect(await bad([client({ name: '' })])).toHaveProperty('items.0.name')
    expect(await bad([client({ name: 'x'.repeat(61) })])).toHaveProperty('items.0.name')
    expect(await bad([client({ logoKey: `avatar/${zero}.png` })])).toHaveProperty('items.0.logoKey')
    expect(await bad([client({ logoKey: '../secret' })])).toHaveProperty('items.0.logoKey')
    expect(await bad([client({ logoKey: `client-logo/${zero}.png` })])).toHaveProperty('items.0.logoKey') // never uploaded
    expect(await bad(Array.from({ length: 25 }, (_, i) => client({ name: `C${i}` })))).toHaveProperty('items')
    // Details.
    expect(await bad([client({ title: 'x'.repeat(101) })])).toHaveProperty('items.0.title')
    expect(await bad([client({ bullets: Array.from({ length: 9 }, (_, i) => `Point ${i}`) })])).toHaveProperty('items.0.bullets')
    expect(await bad([client({ bullets: ['x'.repeat(161)] })])).toHaveProperty('items.0.bullets.0')
    expect(await bad([client({ images: [{ key: `client-logo/${zero}.png`, alt: '' }] })])).toHaveProperty('items.0.images.0.key')
    expect(await bad([client({ images: [{ key: `client-photo/${zero}.png`, alt: '' }] })])).toHaveProperty('items.0.images.0.key') // never uploaded
    const photo = await uploadKey('client-photo')
    expect(await bad([client({ images: Array.from({ length: 5 }, () => ({ key: photo, alt: '' })) })])).toHaveProperty('items.0.images')
    expect(await bad([client({ images: [{ key: photo, alt: 'x'.repeat(151) }] })])).toHaveProperty('items.0.images.0.alt')
    expect(await bad([{ ...client({}), logoMono: 'yes' }])).toHaveProperty('items.0.logoMono')
  })

  it('saves details, drops empty points, and keeps everything private until published', async () => {
    const logo = await uploadKey('client-logo')
    const photos = [await uploadKey('client-photo'), await uploadKey('client-photo')]
    const items: ClientItem[] = [
      client({
        name: 'Real Client',
        logoKey: logo,
        logoMono: false,
        title: 'Launch campaign',
        bullets: ['Shot the hero film', '   ', 'Edited six reels'],
        images: [
          { key: photos[0], alt: 'Behind the scenes on set' },
          { key: photos[1], alt: '' },
        ],
      }),
      client({ name: 'Placeholder Records', logoKey: 'placeholder/client-3.png' }),
      client({ name: 'Name Only Co.' }),
    ]
    const saved = await put('clients', { items })
    expect(saved.status).toBe(200)
    const draft = ((await saved.json()) as HomepageAdminState).draft.clients
    expect(draft[0].bullets).toEqual(['Shot the hero film', 'Edited six reels']) // empty point dropped
    expect(draft[0]).toMatchObject({ logoMono: false, title: 'Launch campaign', images: items[0].images })
    // Older clients sent without the new fields get the defaults.
    expect((await put('clients', { items: [{ name: 'Legacy', logoKey: null }, ...draft] })).status).toBe(200)
    expect((await getState()).draft.clients[0]).toEqual(client({ name: 'Legacy' }))
    await put('clients', { items: draft })

    await showOnly(['clients'])
    expect(JSON.stringify(await publicData())).not.toContain('Launch campaign') // draft only

    expect((await publish()).status).toBe(200)
    expect(await publicClients()).toEqual([
      {
        name: 'Real Client',
        logoUrl: `/media/${logo}`,
        logoMono: false,
        title: 'Launch campaign',
        bullets: ['Shot the hero film', 'Edited six reels'],
        images: [
          { url: `/media/${photos[0]}`, alt: 'Behind the scenes on set' },
          { url: `/media/${photos[1]}`, alt: '' },
        ],
      },
      { name: 'Placeholder Records', logoUrl: '/placeholders/client-3.png', logoMono: true, title: '', bullets: [], images: [] },
      { name: 'Name Only Co.', logoUrl: null, logoMono: true, title: '', bullets: [], images: [] },
    ])
    // Storage keys are never exposed, only URLs.
    expect(JSON.stringify(await publicClients())).not.toMatch(/logoKey|"key"/)
    // The photos really load.
    expect((await call(`${PUBLIC}/media/${photos[0]}`)).status).toBe(200)

    // A later draft edit stays private until the next publish.
    await put('clients', { items: [{ ...draft[0], title: 'Newer title' }, ...draft.slice(1)] })
    expect(JSON.stringify(await publicData())).not.toContain('Newer title')
    await publish()
    expect((await publicClients())?.[0].title).toBe('Newer title')

    // Hiding the section removes the clients from the public data entirely.
    await showOnly([])
    await publish()
    expect(JSON.stringify(await publicData())).not.toContain('Real Client')
  })

  it('cleans up logos and photos nothing uses, but keeps recent uploads and anything a copy uses', async () => {
    const draft = (await getState()).draft.clients
    const usedLogo = draft[0].logoKey!
    const usedPhoto = draft[0].images[0].key
    const orphanLogo = await uploadKey('client-logo')
    const orphanPhoto = await uploadKey('client-photo')

    // Just-uploaded files survive the cleanup that runs after a save (grace period).
    await put('clients', { items: draft })
    await eventually(() => env.IMAGES.head(orphanPhoto), (o) => o !== null)
    expect(await env.IMAGES.head(orphanLogo)).not.toBeNull()
    expect(await env.IMAGES.head(orphanPhoto)).not.toBeNull()

    // Once they're old enough, only the unused ones go.
    const inUse = new Set([usedLogo, ...draft.flatMap((c) => c.images.map((i) => i.key))])
    const removed = await pruneClientMedia(env.IMAGES, inUse, Date.now() + 2 * 60 * 60 * 1000)
    expect(removed).toBeGreaterThanOrEqual(2)
    expect(await env.IMAGES.head(orphanLogo)).toBeNull()
    expect(await env.IMAGES.head(orphanPhoto)).toBeNull()
    expect(await env.IMAGES.head(usedLogo)).not.toBeNull()
    expect(await env.IMAGES.head(usedPhoto)).not.toBeNull()
  })

  it('publishes the clients table, details included, along with everything else', async () => {
    const rows = async (state: string) =>
      (
        await env.DB.prepare('SELECT name, logo_key, logo_mono, title, bullets, images, sort_order FROM homepage_clients WHERE state = ? ORDER BY sort_order')
          .bind(state)
          .all()
      ).results
    expect(await rows('published')).toEqual(await rows('draft'))
  })
})
