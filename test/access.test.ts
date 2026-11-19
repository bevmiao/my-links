import { beforeAll, describe, expect, it } from 'vitest'
import { verifyAccessJwt, type VerifyOptions } from '../worker/lib/access'
import { HttpError } from '../worker/lib/http'
import { AUD, createSigner, TEAM, validClaims } from './helpers'

let signer: Awaited<ReturnType<typeof createSigner>>
let other: Awaited<ReturnType<typeof createSigner>>
const opts = (): VerifyOptions => ({ teamDomain: TEAM, audience: AUD, getKeys: async () => [signer.jwk] })

beforeAll(async () => {
  signer = await createSigner('kid-1')
  other = await createSigner('kid-1') // same kid, different key → forged signature
})

async function rejects(token: string, message: RegExp, o = opts()) {
  const err = await verifyAccessJwt(token, o).catch((e) => e)
  expect(err).toBeInstanceOf(HttpError)
  expect((err as HttpError).status).toBe(401)
  expect((err as HttpError).message).toMatch(message)
}

describe('verifyAccessJwt', () => {
  it('accepts a valid token', async () => {
    const claims = await verifyAccessJwt(await signer.sign(validClaims()), opts())
    expect(claims.email).toBe('owner@example.com')
  })
  it('accepts a string aud', async () => {
    await expect(verifyAccessJwt(await signer.sign(validClaims({ aud: AUD })), opts())).resolves.toBeTruthy()
  })
  it('rejects a forged signature', async () => rejects(await other.sign(validClaims()), /signature/))
  it('rejects a wrong audience', async () => rejects(await signer.sign(validClaims({ aud: ['other-app'] })), /audience/))
  it('rejects a wrong issuer', async () => rejects(await signer.sign(validClaims({ iss: 'https://evil.cloudflareaccess.com' })), /issuer/))
  it('rejects an expired token', async () =>
    rejects(await signer.sign(validClaims({ exp: Math.floor(Date.now() / 1000) - 3600 })), /expired/))
  it('rejects a not-yet-valid token', async () =>
    rejects(await signer.sign(validClaims({ nbf: Math.floor(Date.now() / 1000) + 3600 })), /not yet valid/))
  it('rejects alg=none and unknown algorithms', async () => {
    const [, p] = (await signer.sign(validClaims())).split('.')
    const none = btoa(JSON.stringify({ alg: 'none', kid: 'kid-1' })).replace(/=+$/, '')
    await rejects(`${none}.${p}.`, /Unsupported/)
    await rejects(await signer.sign(validClaims(), { alg: 'HS256' }), /Unsupported/)
  })
  it('rejects unknown key ids (after a refresh attempt)', async () => {
    let refreshed = false
    await rejects(await signer.sign(validClaims(), { kid: 'nope' }), /Unknown/, {
      ...opts(),
      getKeys: async (_t: string, force: boolean) => {
        if (force) refreshed = true
        return [signer.jwk]
      },
    })
    expect(refreshed).toBe(true)
  })
  it('rejects malformed tokens', async () => {
    await rejects('abc', /Malformed/)
    await rejects('a.b.c', /Malformed/)
  })
})
