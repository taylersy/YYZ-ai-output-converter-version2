import assert from 'node:assert/strict'

const baseUrl = process.env.TEST_BASE_URL || 'http://127.0.0.1:8787'
const suffix = `${Date.now()}-${Math.random().toString(16).slice(2)}`
const username = `test-${suffix}`
const registerCode = process.env.TEST_REGISTER_CODE || 'TEST-REGISTER-ONE'
const renewCode = process.env.TEST_RENEW_CODE || 'TEST-RENEW-ONE'

async function request(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init)
  const body = await response.json()
  return { response, body }
}

const health = await request('/api/health')
assert.equal(health.response.status, 200)
assert.equal(health.body.ok, true)

const register = await request('/api/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username, password: 'test-password-123', invite_code: registerCode.toLowerCase() }),
})
assert.equal(register.response.status, 201, JSON.stringify(register.body))
assert.equal(register.body.success, true)
assert.ok(register.body.token)

const reused = await request('/api/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ username: `${username}-other`, password: 'test-password-123', invite_code: registerCode }),
})
assert.equal(reused.response.status, 409, JSON.stringify(reused.body))
assert.equal(reused.body.reason, 'invite_exhausted')

const permission = await request('/api/check-permission', {
  headers: { Authorization: `Bearer ${register.body.token}` },
})
assert.equal(permission.response.status, 200)
assert.equal(permission.body.allowed, true)

const beforeRenewal = new Date(permission.body.vip_expire_time).getTime()
const renewal = await request('/api/redeem-invite', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${register.body.token}`,
  },
  body: JSON.stringify({ invite_code: renewCode.toLowerCase() }),
})
assert.equal(renewal.response.status, 200, JSON.stringify(renewal.body))
assert.equal(renewal.body.success, true)
const afterRenewal = new Date(renewal.body.user.vip_expire_time).getTime()
assert.equal(afterRenewal - beforeRenewal, 30 * 24 * 60 * 60 * 1000)

const reusedRenewal = await request('/api/redeem-invite', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${register.body.token}`,
  },
  body: JSON.stringify({ invite_code: renewCode }),
})
assert.equal(reusedRenewal.response.status, 409, JSON.stringify(reusedRenewal.body))

console.log(JSON.stringify({ ok: true, username, beforeRenewal, afterRenewal }))
