import assert from 'node:assert/strict'

const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:8801'
const adminToken = process.env.TEST_ADMIN_TOKEN || 'test-admin-token'

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init)
  const contentType = response.headers.get('content-type') || ''
  const body = contentType.includes('application/json') ? await response.json() : await response.text()
  return { response, body }
}

const claimPage = await request('/invite')
assert.equal(claimPage.response.status, 200)
assert.match(claimPage.body, /领取你的专属邀请码/)

const adminPage = await request('/invite/admin')
assert.equal(adminPage.response.status, 200)
assert.match(adminPage.body, /邀请码管理台/)

const qr = await request('/invite/qr.svg')
assert.equal(qr.response.status, 200)
assert.match(qr.body, /<svg/)

const first = await request('/api/invite/claim', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: '{}',
})
assert.equal(first.response.status, 200, JSON.stringify(first.body))
assert.ok(first.body.invite_code)
assert.ok(first.body.claim_token)

const repeated = await request('/api/invite/claim', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ claim_token: first.body.claim_token }),
})
assert.equal(repeated.response.status, 200)
assert.equal(repeated.body.invite_code, first.body.invite_code)

const second = await request('/api/invite/claim', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ claim_token: 'tampered-token' }),
})
assert.equal(second.response.status, 200)
assert.notEqual(second.body.invite_code, first.body.invite_code)

const unauthorized = await request('/api/invite/admin/stats')
assert.equal(unauthorized.response.status, 401)

const adminHeaders = { Authorization: `Bearer ${adminToken}` }
const beforeStats = await request('/api/invite/admin/stats', { headers: adminHeaders })
assert.deepEqual(beforeStats.body, { total: 4, unissued: 2, issued_unused: 2, redeemed: 0 })

const username = `manager-test-${Date.now()}`
const register = await request('/api/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username,
    password: 'test-password-123',
    invite_code: first.body.invite_code,
  }),
})
assert.equal(register.response.status, 201, JSON.stringify(register.body))

const afterStats = await request('/api/invite/admin/stats', { headers: adminHeaders })
assert.deepEqual(afterStats.body, { total: 4, unissued: 2, issued_unused: 1, redeemed: 1 })

const claims = await request('/api/invite/admin/claims', { headers: adminHeaders })
assert.equal(claims.response.status, 200)
assert.equal(claims.body.claims.length, 2)
assert.ok(claims.body.claims.some((item) => item.username === username && item.redeemed === 1))

const exported = await request('/api/invite/admin/export', { headers: adminHeaders })
assert.equal(exported.response.status, 200)
assert.match(exported.body, /已注册使用/)
assert.match(exported.body, /已发放未注册/)
assert.match(exported.body, /尚未发放/)

console.log(JSON.stringify({
  ok: true,
  firstCode: first.body.invite_code,
  secondCode: second.body.invite_code,
  stats: afterStats.body,
}))
