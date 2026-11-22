import { env } from 'cloudflare:workers'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SECTION_KEYS, type HomepageAdminState, type PublicPageData } from '../shared/types'
import { pruneClientLogos } from '../worker/lib/media'
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

function uploadLogo(bytes: Uint8Array, name = 'logo.png', type = 'image/png') {
  const form = new FormData()
  form.append('file', new File([bytes], name, { type }))
  return adminCall(token, '/api/admin/images/client-logo', { method: 'POST', body: form })
}

const gifBytes = () => Uint8Array.from(atob('R0lGODlhAQABAAAAACw='), (c) => c.charCodeAt(0))

// Tests in this file run in order and share one isolated database.
describe('client logo strip', () => {
  it('starts with placeholder clients in the draft only, with the section hidden', async () => {
    const s = await getState()
    expect(s.draft.clients).toEqual([
      { name: 'Placeholder Studio', logoKey: 'placeholder/client-1.png' },
      { name: 'Placeholder Coffee Co.', logoKey: 'placeholder/client-2.png' },
      { name: 'Placeholder Records', logoKey: 'placeholder/client-3.png' },
      { name: 'Placeholder Outdoors', logoKey: 'placeholder/client-4.png' },
      { name: 'Placeholder Agency', logoKey: null },
    ])
    expect(s.draft.sections.find((x) => x.key === 'clients')).toEqual({ key: 'clients', visible: false })
    expect(s.published).toBeNull()
    expect(JSON.stringify(await publicData())).not.toContain('Placeholder Studio')
  })

  it('uploads logos to client-logo/ with the same checks as other images, minus GIF and SVG', async () => {
    const res = await uploadLogo(pngBytes())
    expect(res.status).toBe(201)
    const { key, url } = (await res.json()) as { key: string; url: string }
    expect(key).toMatch(/^client-logo\/[0-9a-f-]{36}\.png$/)
    expect(url).toBe(`/media/${key}`)
    const media = await call(`${PUBLIC}${url}`)
    expect(media.status).toBe(200)
    expect(media.headers.get('Content-Type')).toBe('image/png')
    expect(media.headers.get('X-Content-Type-Options')).toBe('nosniff')

    // GIFs are real images but not allowed for logos.
    expect((await uploadLogo(gifBytes(), 'a.gif', 'image/gif')).status).toBe(415)
    // SVG is rejected, even disguised as a PNG.
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>')
    expect((await uploadLogo(svg, 'logo.svg', 'image/svg+xml')).status).toBe(415)
    expect((await uploadLogo(svg, 'logo.png', 'image/png')).status).toBe(415)
    // 1 MB limit.
    const big = new Uint8Array(1024 * 1024 + 1)
    big.set(pngBytes())
    expect((await uploadLogo(big)).status).toBe(413)
    // Uploads need Access like every admin route, and never work on the public host.
    expect((await call(`${PUBLIC}/api/admin/images/client-logo`, { method: 'POST' })).status).toBe(404)
  })

  it('validates names and logo keys, and only accepts logos that exist', async () => {
    const bad = async (items: unknown[]) => {
      const res = await put('clients', { items })
      expect(res.status).toBe(422)
      return ((await res.json()) as { fields: Record<string, string> }).fields
    }
    expect(await bad([{ name: '', logoKey: null }])).toHaveProperty('items.0.name')
    expect(await bad([{ name: 'x'.repeat(61), logoKey: null }])).toHaveProperty('items.0.name')
    expect(await bad([{ name: 'Acme', logoKey: 'avatar/00000000-0000-0000-0000-000000000000.png' }])).toHaveProperty('items.0.logoKey')
    expect(await bad([{ name: 'Acme', logoKey: '../secret' }])).toHaveProperty('items.0.logoKey')
    // Right shape, but never uploaded.
    expect(await bad([{ name: 'Acme', logoKey: 'client-logo/00000000-0000-0000-0000-000000000000.png' }])).toHaveProperty('items.0.logoKey')
    expect(await bad(Array.from({ length: 25 }, (_, i) => ({ name: `C${i}`, logoKey: null })))).toHaveProperty('items')
  })

  it('edits, reorders and removes clients in the draft, private until published', async () => {
    const { key } = (await (await uploadLogo(pngBytes())).json()) as { key: string }
    const items = [
      { name: 'Real Client', logoKey: key },
      { name: 'Placeholder Records', logoKey: 'placeholder/client-3.png' },
      { name: 'Name Only Co.', logoKey: null },
    ]
    const saved = await put('clients', { items })
    expect(saved.status).toBe(200)
    expect(((await saved.json()) as HomepageAdminState).draft.clients).toEqual(items)
    await showOnly(['clients'])
    expect(JSON.stringify(await publicData())).not.toContain('Real Client') // draft only

    expect((await publish()).status).toBe(200)
    const strip = (await publicData()).homepage!.sections.find((s) => s.key === 'clients')
    expect(strip).toEqual({
      key: 'clients',
      items: [
        { name: 'Real Client', logoUrl: `/media/${key}` },
        { name: 'Placeholder Records', logoUrl: '/placeholders/client-3.png' },
        { name: 'Name Only Co.', logoUrl: null },
      ],
    })
    // Storage keys are never exposed, only URLs.
    expect(JSON.stringify(strip)).not.toContain('logoKey')

    // Reorder and remove, then publish again.
    await put('clients', { items: [items[2], items[0]] })
    await publish()
    const after = (await publicData()).homepage!.sections.find((s) => s.key === 'clients')
    expect(after && 'items' in after ? after.items.map((c) => c.name) : []).toEqual(['Name Only Co.', 'Real Client'])

    // Hiding the section removes the clients from the public data entirely.
    await showOnly([])
    await publish()
    expect(JSON.stringify(await publicData())).not.toContain('Real Client')
  })

  it('cleans up logos nothing uses, but keeps recent uploads and anything a copy still uses', async () => {
    const used = (await getState()).draft.clients.find((c) => c.name === 'Real Client')!.logoKey!
    const { key: orphan } = (await (await uploadLogo(pngBytes())).json()) as { key: string }

    // A just-uploaded logo survives the cleanup that runs after a save (grace period).
    await put('clients', { items: (await getState()).draft.clients })
    await eventually(() => env.IMAGES.head(orphan), (o) => o !== null)
    expect(await env.IMAGES.head(orphan)).not.toBeNull()

    // Once it's old enough, only the unused one goes.
    const inUse = new Set([used])
    const removed = await pruneClientLogos(env.IMAGES, inUse, Date.now() + 2 * 60 * 60 * 1000)
    expect(removed).toBeGreaterThanOrEqual(1)
    expect(await env.IMAGES.head(orphan)).toBeNull()
    expect(await env.IMAGES.head(used)).not.toBeNull()
  })

  it('publishes the clients table along with everything else', async () => {
    const rows = async (state: string) =>
      (await env.DB.prepare('SELECT name, logo_key, sort_order FROM homepage_clients WHERE state = ? ORDER BY sort_order').bind(state).all()).results
    expect(await rows('published')).toEqual(await rows('draft'))
  })
})
