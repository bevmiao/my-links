import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { SECTION_KEYS, type Profile } from '../shared/types'
import { adminCall, call, createSigner, mockAccessCerts, pngBytes, PUBLIC, validClaims } from './helpers'

let token: string
let restoreFetch: () => void

beforeAll(async () => {
  const signer = await createSigner()
  token = await signer.sign(validClaims())
  restoreFetch = mockAccessCerts([signer.jwk]).mockRestore
})
afterAll(() => restoreFetch())

const put = (section: string, json: unknown) => adminCall(token, `/api/admin/homepage/${section}`, { method: 'PUT', json })
const publish = () => adminCall(token, '/api/admin/homepage/publish', { method: 'POST' })
const showOnly = (visible: string[]) => put('sections', { items: SECTION_KEYS.map((key) => ({ key, visible: visible.includes(key) })) })

/** All <meta> tags in the page, keyed by property / name. */
async function metaTags(url: string) {
  const html = await (await call(url)).text()
  const tags: Record<string, string> = {}
  for (const m of html.matchAll(/<meta (?:property|name)="([^"]+)" content="([^"]*)" \/>/g)) tags[m[1]] = m[2]
  return { html, tags }
}

async function setProfile(patch: Partial<Profile>) {
  const profile = (await (await adminCall(token, '/api/admin/profile')).json()) as Profile
  const res = await adminCall(token, '/api/admin/profile', { method: 'PUT', json: { ...profile, ...patch } })
  expect(res.status).toBe(200)
}

// Tests in this file run in order and share one isolated database.
describe('share preview (Open Graph and Twitter cards)', () => {
  it('leaves image tags out when there is no profile photo', async () => {
    const { tags } = await metaTags(`${PUBLIC}/`)
    expect(tags['og:image']).toBeUndefined()
    expect(tags['twitter:image']).toBeUndefined()
    expect(tags['twitter:card']).toBe('summary')
  })

  it('fills name, photo and tagline from the profile, with absolute URLs on the public host', async () => {
    await setProfile({ displayName: 'Ryan Test', bio: 'Photos and films.' })
    const form = new FormData()
    form.append('file', new File([pngBytes()], 'me.png', { type: 'image/png' }))
    const { avatarUrl } = (await (await adminCall(token, '/api/admin/images/avatar', { method: 'POST', body: form })).json()) as Profile

    const { tags, html } = await metaTags(`${PUBLIC}/`)
    expect(tags['og:title']).toBe('Ryan Test')
    expect(tags['twitter:title']).toBe('Ryan Test')
    expect(tags['og:site_name']).toBe('Ryan Test')
    expect(tags['og:description']).toBe('Photos and films.') // nothing published yet, so the bio
    expect(tags['twitter:description']).toBe('Photos and films.')
    expect(tags['og:image']).toBe(`${PUBLIC}${avatarUrl}`)
    expect(tags['twitter:image']).toBe(`${PUBLIC}${avatarUrl}`)
    expect(tags['og:image:alt']).toBe('Photo of Ryan Test')
    expect(tags['og:url']).toBe(`${PUBLIC}/`)
    expect(html).toContain(`<link rel="canonical" href="${PUBLIC}/" />`)
    // The image really is served at that URL.
    expect((await call(tags['og:image'])).status).toBe(200)
  })

  it('always uses PUBLIC_HOSTNAME, whichever host the request arrived on', async () => {
    const { tags, html } = await metaTags('https://some-other-host.example.net/about')
    expect(tags['og:image']).toMatch(new RegExp(`^${PUBLIC}/media/avatar/`))
    expect(tags['og:url']).toBe(`${PUBLIC}/about`)
    expect(tags['og:title']).toBe('About · Ryan Test')
    expect(html).toContain(`<link rel="canonical" href="${PUBLIC}/about" />`)
    expect(html).not.toContain('some-other-host')
  })

  it('never shows unpublished content: a draft headline stays out until it is published', async () => {
    await put('intro', { headline: 'DRAFT-ONLY tagline', about: '' })
    await showOnly(['intro'])
    let { html, tags } = await metaTags(`${PUBLIC}/`)
    expect(html).not.toContain('DRAFT-ONLY')
    expect(tags['og:description']).toBe('Photos and films.')

    await publish()
    ;({ tags } = await metaTags(`${PUBLIC}/`))
    expect(tags['og:description']).toBe('DRAFT-ONLY tagline')
    expect(tags['twitter:description']).toBe('DRAFT-ONLY tagline')
    expect(tags.description).toBe('DRAFT-ONLY tagline')

    // A later draft edit doesn't change the preview until the next publish.
    await put('intro', { headline: 'Newer draft line', about: '' })
    ;({ html } = await metaTags(`${PUBLIC}/`))
    expect(html).not.toContain('Newer draft line')
  })

  it('ignores a published headline whose section is hidden', async () => {
    await showOnly([])
    await publish()
    const { html, tags } = await metaTags(`${PUBLIC}/`)
    expect(tags['og:description']).toBe('Photos and films.')
    expect(html).not.toContain('Newer draft line')
  })

  it('escapes and shortens long taglines', async () => {
    await setProfile({ bio: `"Quoted" <b>bold</b> ${'word '.repeat(60)}`.slice(0, 280) })
    const { html, tags } = await metaTags(`${PUBLIC}/`)
    expect(html).not.toContain('<b>bold</b>')
    expect(tags['og:description']).toMatch(/^&quot;Quoted&quot; &lt;b&gt;bold&lt;\/b&gt;/)
    expect(tags['og:description'].endsWith('…')).toBe(true)
  })
})
