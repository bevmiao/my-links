import { describe, expect, it } from 'vitest'
import { normalizeUrl, sniffImageType, validateLinkInput, validateProfileInput } from '../shared/validation'
import { safeJsonForHtml } from '../worker/lib/html'
import { deviceClass, referrerHost } from '../worker/lib/analytics'
import { parseYouTubeId } from '../shared/homepage'

describe('normalizeUrl', () => {
  it('accepts http(s) and mailto, adding https:// when missing', () => {
    expect(normalizeUrl('example.com/a')).toBe('https://example.com/a')
    expect(normalizeUrl('http://example.com')).toBe('http://example.com/')
    expect(normalizeUrl('mailto:me@example.com')).toBe('mailto:me@example.com')
  })
  it.each(['javascript:alert(1)', 'data:text/html,hi', 'vbscript:x', 'ftp://example.com', 'https://user:pw@example.com', 'localhost', 'mailto:nope', ''])(
    'rejects %s',
    (u) => expect(normalizeUrl(u)).toBeNull(),
  )
})

describe('validateLinkInput', () => {
  it('trims and defaults', () => {
    const r = validateLinkInput({ title: '  Hello ', url: 'example.com' })
    expect(r).toEqual({ ok: true, value: { title: 'Hello', url: 'https://example.com/', description: '', icon: '', category: '', isActive: true } })
  })
  it('reports field errors', () => {
    const r = validateLinkInput({ title: 'x'.repeat(200), url: 'javascript:1', icon: '<b>', category: 'c'.repeat(41), isActive: 'yes' })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(Object.keys(r.fields).sort()).toEqual(['category', 'icon', 'isActive', 'title', 'url'])
  })
})

describe('validateProfileInput', () => {
  const base = {
    username: '@alex',
    displayName: 'Alex',
    bio: 'Hi',
    themeMode: 'dark',
    accentColor: '#AABBCC',
    backgroundLight: '#ffffff',
    backgroundDark: '#000000',
    buttonStyle: 'pill',
    socials: [{ platform: 'github', url: 'github.com/alex' }],
  }
  it('normalises valid input', () => {
    const r = validateProfileInput(base)
    expect(r.ok && r.value).toMatchObject({ username: 'alex', accentColor: '#aabbcc', socials: [{ platform: 'github', url: 'https://github.com/alex' }] })
  })
  it('defaults the film grain to moving and rejects unknown values', () => {
    const r = validateProfileInput(base)
    expect(r.ok && r.value.grain).toBe('moving') // older clients omit it
    for (const grain of ['moving', 'still', 'off']) {
      const ok = validateProfileInput({ ...base, grain })
      expect(ok.ok && ok.value.grain).toBe(grain)
    }
    const bad = validateProfileInput({ ...base, grain: 'loud' })
    expect(!bad.ok && bad.fields.grain).toBeTruthy()
  })
  it('rejects bad colours, modes, usernames and socials', () => {
    const r = validateProfileInput({ ...base, username: 'a b', accentColor: 'red', themeMode: 'neon', socials: [{ platform: 'x', url: 'javascript:1' }] })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.fields).toMatchObject({ username: expect.any(String), accentColor: expect.any(String), themeMode: expect.any(String), 'socials.0': expect.any(String) })
  })
})

describe('sniffImageType', () => {
  it('detects by magic bytes', () => {
    expect(sniffImageType(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png')
    expect(sniffImageType(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg')
    expect(sniffImageType(new TextEncoder().encode('GIF89a...'))).toBe('image/gif')
    expect(sniffImageType(new TextEncoder().encode('RIFF\0\0\0\0WEBPVP8 '))).toBe('image/webp')
    expect(sniffImageType(new TextEncoder().encode('<svg onload=alert(1)>'))).toBeNull()
  })
})

describe('helpers', () => {
  it('escapes JSON for embedding in <script>', () => {
    const out = safeJsonForHtml({ bio: '</script><script>alert(1)</script>&' })
    expect(out).not.toContain('<')
    expect(out).not.toContain('>')
    expect(JSON.parse(out).bio).toBe('</script><script>alert(1)</script>&')
  })
  it('classifies devices and referrers', () => {
    expect(deviceClass('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) Mobile')).toBe('mobile')
    expect(deviceClass('Mozilla/5.0 (iPad; CPU OS 17_0)')).toBe('tablet')
    expect(deviceClass('Mozilla/5.0 (Windows NT 10.0)')).toBe('desktop')
    expect(referrerHost('https://www.google.com/search?q=x', ['links.example.com'])).toBe('google.com')
    expect(referrerHost('https://links.example.com/', ['links.example.com'])).toBeNull()
    expect(referrerHost('javascript:alert(1)', [])).toBeNull()
  })
})

describe('parseYouTubeId', () => {
  const ID = 'dQw4w9WgXcQ'
  it('accepts the links people paste from YouTube', () => {
    for (const input of [
      ID,
      `https://www.youtube.com/watch?v=${ID}`,
      `https://youtube.com/watch?v=${ID}&t=42s`,
      `https://m.youtube.com/watch?v=${ID}`,
      `youtube.com/watch?v=${ID}`,
      `https://youtu.be/${ID}?si=abc123`,
      `https://www.youtube.com/shorts/${ID}`,
      `https://www.youtube.com/embed/${ID}`,
      `https://www.youtube-nocookie.com/embed/${ID}`,
      `https://www.youtube.com/live/${ID}?feature=share`,
      `  https://youtu.be/${ID}  `,
    ])
      expect(parseYouTubeId(input), input).toBe(ID)
  })
  it('rejects anything else', () => {
    for (const input of [
      '',
      'hello',
      `https://evil.example/watch?v=${ID}`,
      `https://youtube.com.evil.example/watch?v=${ID}`,
      `https://www.youtube.com/playlist?list=PL123`,
      `https://www.youtube.com/@someone`,
      `javascript:alert(1)//youtu.be/${ID}`,
      `https://youtu.be/${ID}x`,
      `https://www.youtube.com/watch?v=<script>`,
    ])
      expect(parseYouTubeId(input), input).toBeNull()
  })
})
