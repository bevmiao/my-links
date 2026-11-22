import { env } from 'cloudflare:workers'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { AnalyticsSummary, Link, Profile, PublicPageData } from '../shared/types'
import { ADMIN, adminCall, BROWSER_UA, call, createSigner, eventually, mockAccessCerts, pngBytes, PUBLIC, validClaims } from './helpers'

let token: string
let signer: Awaited<ReturnType<typeof createSigner>>
let restoreFetch: () => void

beforeAll(async () => {
  signer = await createSigner()
  token = await signer.sign(validClaims())
  restoreFetch = mockAccessCerts([signer.jwk]).mockRestore
})
afterAll(() => restoreFetch())

beforeEach(async () => {
  await env.DB.batch([env.DB.prepare('DELETE FROM analytics_events'), env.DB.prepare('DELETE FROM links')])
})

async function createLink(input: Record<string, unknown>) {
  const res = await adminCall(token, '/api/admin/links', { method: 'POST', json: input })
  expect(res.status).toBe(201)
  return (await res.json()) as Link
}

describe('hostname routing & Access enforcement', () => {
  it('never serves admin paths on the public hostname', async () => {
    expect((await call(`${PUBLIC}/admin`)).status).toBe(404)
    expect((await call(`${PUBLIC}/api/admin/profile`, { headers: { 'Cf-Access-Jwt-Assertion': token } })).status).toBe(404)
  })

  it('rejects admin API calls without a token — even with DEV_AUTH_BYPASS=true on a real hostname', async () => {
    expect(env.DEV_AUTH_BYPASS).toBe('true')
    const res = await call(`${ADMIN}/api/admin/profile`)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Missing Cloudflare Access token' })
  })

  it('allows WebAssembly and blob: workers on the dashboard only (HEIC conversion), never on public pages', async () => {
    const admin = (await call(`${ADMIN}/admin`, { headers: { 'Cf-Access-Jwt-Assertion': token } })).headers.get('Content-Security-Policy') ?? ''
    expect(admin).toContain("script-src 'self' 'wasm-unsafe-eval';")
    expect(admin).toContain("worker-src 'self' blob:;")
    expect(admin).not.toContain("'unsafe-eval'")
    expect(admin).not.toMatch(/script-src[^;]*'unsafe-inline'/)
    for (const path of ['/', '/about', '/work']) {
      const pub = (await call(`${PUBLIC}${path}`)).headers.get('Content-Security-Policy') ?? ''
      expect(pub).toContain("script-src 'self';")
      expect(pub).not.toContain('wasm-unsafe-eval')
      expect(pub).not.toContain('worker-src')
    }
  })

  it('protects admin pages and assets too, not just the API', async () => {
    expect((await call(`${ADMIN}/admin`)).status).toBe(401)
    expect((await call(`${ADMIN}/favicon.svg`)).status).toBe(401)
    const ok = await call(`${ADMIN}/admin/links`, { headers: { 'Cf-Access-Jwt-Assertion': token } })
    expect(ok.status).toBe(200)
    expect(ok.headers.get('Cache-Control')).toBe('no-store')
    expect(ok.headers.get('X-Robots-Tag')).toContain('noindex')
  })

  it('rejects forged, expired and wrong-audience tokens', async () => {
    const forger = await createSigner() // same kid, different key
    for (const bad of [
      await forger.sign(validClaims()),
      await signer.sign(validClaims({ exp: 1 })),
      await signer.sign(validClaims({ aud: ['another-app'] })),
    ]) {
      expect((await adminCall(bad, '/api/admin/profile')).status).toBe(401)
    }
  })

  it('enforces the optional ADMIN_EMAILS allowlist', async () => {
    const stranger = await signer.sign(validClaims({ email: 'someone@else.com' }))
    expect((await adminCall(stranger, '/api/admin/profile')).status).toBe(403)
  })

  it('identifies the signed-in owner', async () => {
    const res = await adminCall(token, '/api/admin/me')
    expect(await res.json()).toEqual({ email: 'owner@example.com', devBypass: false, publicUrl: 'https://links.example.com/' })
  })

  it('redirects the admin root to the dashboard', async () => {
    const res = await adminCall(token, '/', { redirect: 'manual' })
    expect(res.status).toBe(302)
    expect(res.headers.get('Location')).toBe(`${ADMIN}/admin`)
  })

  it('blocks cross-origin mutations (CSRF)', async () => {
    const res = await adminCall(token, '/api/admin/links', {
      method: 'POST',
      json: { title: 'x', url: 'example.com' },
      headers: { Origin: 'https://evil.example' },
    })
    expect(res.status).toBe(403)
  })
})

describe('profile', () => {
  it('reads the migrated default profile and updates it with validation', async () => {
    const before = (await (await adminCall(token, '/api/admin/profile')).json()) as Profile
    expect(before.displayName).toBe('Your Name')

    const bad = await adminCall(token, '/api/admin/profile', { method: 'PUT', json: { ...before, accentColor: 'blue' } })
    expect(bad.status).toBe(422)
    expect(((await bad.json()) as { fields: Record<string, string> }).fields.accentColor).toBeTruthy()

    const res = await adminCall(token, '/api/admin/profile', {
      method: 'PUT',
      json: { ...before, displayName: 'Sam', username: '@sam', socials: [{ platform: 'github', url: 'github.com/sam' }] },
    })
    expect(res.status).toBe(200)
    const after = (await res.json()) as Profile
    expect(after).toMatchObject({ displayName: 'Sam', username: 'sam', socials: [{ platform: 'github', url: 'https://github.com/sam' }] })
  })

  it('stores the film grain setting and exposes it publicly', async () => {
    const before = (await (await adminCall(token, '/api/admin/profile')).json()) as Profile
    expect(before.grain).toBe('moving') // migration default keeps the current look
    const res = await adminCall(token, '/api/admin/profile', { method: 'PUT', json: { ...before, grain: 'off' } })
    expect(((await res.json()) as Profile).grain).toBe('off')
    expect(((await (await call(`${PUBLIC}/api/profile`)).json()) as PublicPageData).profile.grain).toBe('off')
    expect((await adminCall(token, '/api/admin/profile', { method: 'PUT', json: { ...before, grain: 'static' } })).status).toBe(422)
  })

  it('requires JSON bodies', async () => {
    const res = await adminCall(token, '/api/admin/profile', { method: 'PUT', body: 'displayName=x', headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
    expect(res.status).toBe(415)
  })
})

describe('links', () => {
  it('creates, edits, toggles, reorders and deletes', async () => {
    const a = await createLink({ title: 'A', url: 'a.example.com' })
    const b = await createLink({ title: 'B', url: 'https://b.example.com', icon: 'github', description: 'bee', category: '  Work ' })
    const c = await createLink({ title: 'C', url: 'mailto:c@example.com', isActive: false })
    expect([a.sortOrder, b.sortOrder, c.sortOrder]).toEqual([0, 1, 2])

    const edited = (await (await adminCall(token, `/api/admin/links/${a.id}`, { method: 'PATCH', json: { title: 'A2' } })).json()) as Link
    expect(edited).toMatchObject({ title: 'A2', url: 'https://a.example.com/' })

    const badEdit = await adminCall(token, `/api/admin/links/${a.id}`, { method: 'PATCH', json: { url: 'javascript:alert(1)' } })
    expect(badEdit.status).toBe(422)

    const reordered = (await (await adminCall(token, '/api/admin/links/order', { method: 'PUT', json: { ids: [c.id, a.id, b.id] } })).json()) as Link[]
    expect(reordered.map((l) => l.id)).toEqual([c.id, a.id, b.id])
    expect((await adminCall(token, '/api/admin/links/order', { method: 'PUT', json: { ids: [a.id, a.id, b.id] } })).status).toBe(400)

    // Public view: only active links, in order, without internal fields.
    const page = (await (await call(`${PUBLIC}/api/profile`)).json()) as PublicPageData
    expect(page.links).toEqual([
      { id: a.id, title: 'A2', url: 'https://a.example.com/', description: '', icon: '', category: '' },
      { id: b.id, title: 'B', url: 'https://b.example.com/', description: 'bee', icon: 'github', category: 'Work' },
    ])

    expect((await adminCall(token, `/api/admin/links/${b.id}`, { method: 'DELETE' })).status).toBe(204)
    expect((await adminCall(token, `/api/admin/links/${b.id}`, { method: 'DELETE' })).status).toBe(404)
    expect((await adminCall(token, '/api/admin/links/abc', { method: 'DELETE' })).status).toBe(400)
  })
})

describe('public page', () => {
  it('embeds escaped profile data and meta tags in the HTML with a strict CSP', async () => {
    const profile = (await (await adminCall(token, '/api/admin/profile')).json()) as Profile
    await adminCall(token, '/api/admin/profile', { method: 'PUT', json: { ...profile, bio: 'Hi </script><script>alert(1)</script>' } })
    const res = await call(`${PUBLIC}/`)
    expect(res.status).toBe(200)
    const html = await res.text()
    expect(html).toContain('<script type="application/json" id="initial-data">')
    expect(html).not.toContain('</script><script>alert(1)')
    expect(html).toContain('<meta name="description" content="Hi &lt;/script&gt;')
    expect(html.match(/name="description"/g)).toHaveLength(1)
    expect(html).toMatch(/<title>.*\(@.*\)<\/title>/)
    expect(html).toContain('property="og:title"')
    expect(res.headers.get('Content-Security-Policy')).toContain("script-src 'self'")
    expect(res.headers.get('X-Frame-Options')).toBe('DENY')
  })
})

describe('analytics', () => {
  it('records real views and clicks, ignores bots and hidden links, and summarises', async () => {
    const link = await createLink({ title: 'Go', url: 'https://dest.example.com/x' })
    const hidden = await createLink({ title: 'Hidden', url: 'https://hidden.example.com', isActive: false })

    const view = await call(`${PUBLIC}/api/track/view`, {
      method: 'POST',
      headers: { 'User-Agent': BROWSER_UA, 'Content-Type': 'application/json' },
      body: JSON.stringify({ referrer: 'https://www.google.com/search?q=me' }),
    })
    expect(view.status).toBe(204)
    await call(`${PUBLIC}/api/track/view`, { method: 'POST', headers: { 'User-Agent': 'Googlebot/2.1' }, body: '{}' })

    const click = await call(`${PUBLIC}/go/${link.id}`, { headers: { 'User-Agent': BROWSER_UA }, redirect: 'manual' })
    expect(click.status).toBe(302)
    expect(click.headers.get('Location')).toBe('https://dest.example.com/x')

    // Hidden or unknown links never redirect off-site (no open redirect).
    const blocked = await call(`${PUBLIC}/go/${hidden.id}`, { headers: { 'User-Agent': BROWSER_UA }, redirect: 'manual' })
    expect(blocked.headers.get('Location')).toBe(`${PUBLIC}/`)

    const summary = await eventually(
      async () => (await (await adminCall(token, '/api/admin/analytics?days=7')).json()) as AnalyticsSummary,
      (s) => s.totals.views === 1 && s.totals.clicks === 1,
    )
    expect(summary.totals).toMatchObject({ views: 1, clicks: 1, ctr: 1, allTimeViews: 1, allTimeClicks: 1 })
    expect(summary.daily).toHaveLength(7)
    expect(summary.daily.at(-1)).toMatchObject({ views: 1, clicks: 1 })
    expect(summary.links[0]).toMatchObject({ id: link.id, clicks: 1 })
    expect(summary.referrers).toEqual([{ name: 'google.com', count: 1 }])
    expect(summary.devices).toEqual([{ name: 'Desktop', count: 1 }])
  })

  it('clamps the range to supported values', async () => {
    const s = (await (await adminCall(token, '/api/admin/analytics?days=9999')).json()) as AnalyticsSummary
    expect(s.rangeDays).toBe(30)
  })
})

describe('R2 image uploads', () => {
  function upload(kind: string, bytes: Uint8Array, name = 'a.png', type = 'image/png') {
    const form = new FormData()
    form.append('file', new File([bytes], name, { type }))
    return adminCall(token, `/api/admin/images/${kind}`, { method: 'POST', body: form })
  }

  it('stores a valid image, serves it publicly, and replaces/removes it', async () => {
    const res = await upload('avatar', pngBytes())
    expect(res.status).toBe(200)
    const p1 = (await res.json()) as Profile
    expect(p1.avatarUrl).toMatch(/^\/media\/avatar\/[0-9a-f-]{36}\.png$/)

    const media = await call(`${PUBLIC}${p1.avatarUrl}`)
    expect(media.status).toBe(200)
    expect(media.headers.get('Content-Type')).toBe('image/png')
    expect(new Uint8Array(await media.arrayBuffer())).toEqual(pngBytes())

    const p2 = (await (await upload('avatar', pngBytes())).json()) as Profile
    expect(p2.avatarUrl).not.toBe(p1.avatarUrl)
    const oldKey = p1.avatarUrl!.replace('/media/', '')
    await eventually(() => env.IMAGES.head(oldKey), (o) => o === null) // previous image cleaned up
    expect(await env.IMAGES.head(oldKey)).toBeNull()

    const p3 = (await (await adminCall(token, '/api/admin/images/avatar', { method: 'DELETE' })).json()) as Profile
    expect(p3.avatarUrl).toBeNull()
  })

  it('rejects disguised files, oversized files and unknown kinds', async () => {
    const svg = new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>')
    expect((await upload('avatar', svg, 'x.png', 'image/png')).status).toBe(415)

    const big = new Uint8Array(3 * 1024 * 1024)
    big.set(pngBytes())
    expect((await upload('avatar', big)).status).toBe(413)

    expect((await upload('banner', pngBytes())).status).toBe(404)
  })

  it('only serves keys the Worker generated', async () => {
    await env.IMAGES.put('private/secret.txt', 'secret')
    expect((await call(`${PUBLIC}/media/private/secret.txt`)).status).toBe(404)
  })
})
