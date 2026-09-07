import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const baseUrl = process.env.TEST_BASE_URL || 'https://yyz-ai-output-conventer-version2.auth.taylersy.com'
const expectedCode = process.env.TEST_INVITE_CODE || 'YYZ1M2609-0000-ONLINE-TEST'
const tokenPath = process.env.TEST_ADMIN_TOKEN_FILE || resolve(import.meta.dirname, '../../.invite-admin-token')
const adminToken = readFileSync(tokenPath, 'utf8').trim()

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init)
  const contentType = response.headers.get('content-type') || ''
  const body = contentType.includes('application/json') ? await response.json() : await response.text()
  return { response, body }
}

for (const [path, pattern] of [['/invite', /领取你的专属邀请码/], ['/invite/admin', /邀请码管理台/], ['/invite/qr.svg', /<svg/]]) {
  const page = await request(path)
  assert.equal(page.response.status, 200)
  assert.match(page.body, pattern)
}

const first = await request('/api/invite/claim', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
})
assert.equal(first.response.status, 200, JSON.stringify(first.body))
assert.equal(first.body.invite_code, expectedCode)
assert.ok(first.body.claim_token)

const repeated = await request('/api/invite/claim', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ claim_token: first.body.claim_token }),
})
assert.equal(repeated.response.status, 200)
assert.equal(repeated.body.invite_code, expectedCode)

const unauthorized = await request('/api/invite/admin/stats')
assert.equal(unauthorized.response.status, 401)

const headers = { Authorization: `Bearer ${adminToken}` }
const stats = await request('/api/invite/admin/stats', { headers })
assert.equal(stats.response.status, 200)
assert.equal(stats.body.total, 1001)
assert.ok(stats.body.issued_unused >= 1)

const claims = await request('/api/invite/admin/claims', { headers })
assert.equal(claims.response.status, 200)
assert.ok(claims.body.claims.some((claim) => claim.invite_code === expectedCode))

const exported = await request('/api/invite/admin/export', { headers })
assert.equal(exported.response.status, 200)
assert.match(exported.body, new RegExp(expectedCode))

console.log(JSON.stringify({
  ok: true,
  inviteCode: expectedCode,
  claimId: first.body.claim_token.split('.')[0],
  stats: stats.body,
}))
