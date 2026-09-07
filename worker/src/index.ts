import { Hono, type Context, type Next } from 'hono'
import { cors } from 'hono/cors'
import { jwt, sign } from 'hono/jwt'
import claimQrSvg from '../assets/invite-claim-qr.svg'
import { adminPage, claimPage } from './invite-site'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
  CLAIM_SECRET: string
  INVITE_ADMIN_TOKEN: string
}

type JwtPayload = {
  user_id: number
  exp: number
}

type Invite = {
  duration_days: number
  max_uses: number
  used_count: number
}

type UserSubscription = {
  id: number
  username: string
  vip_expire_time: string
}

type ClaimRecord = {
  invite_code: string
  claimed_at: string
  last_seen_at: string
  used_count: number
}

const INVITE_CAMPAIGN_PREFIX = 'YYZ1M2609-'
const encoder = new TextEncoder()

const app = new Hono<{ Bindings: Bindings }>()

app.onError((err, c) => {
  console.error('Global Error:', err)
  const message = err instanceof Error ? err.message : String(err)
  if (message.toLowerCase().includes('jwt')) {
    return c.json({ error: 'Unauthorized', reason: 'unauthorized' }, 401)
  }
  const status = (err as { status?: number }).status
  if (status) {
    return c.json({ error: message }, status as 400 | 401 | 403 | 404 | 409 | 500)
  }
  return c.json({ error: 'Internal Server Error' }, 500)
})

app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  maxAge: 86400,
}))

function generateSalt(): string {
  const array = new Uint8Array(16)
  crypto.getRandomValues(array)
  return Array.from(array).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(password + salt)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(hashBuffer))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function normalizeInviteCode(value: unknown): string {
  return typeof value === 'string' ? value.trim().toUpperCase() : ''
}

function validateRegistrationInput(username: unknown, password: unknown, inviteCode: string): string | null {
  if (typeof username !== 'string' || typeof password !== 'string' || !inviteCode) {
    return 'Missing required parameters'
  }
  const normalizedUsername = username.trim()
  if (normalizedUsername.length < 3 || normalizedUsername.length > 64) {
    return 'Username must be 3-64 characters'
  }
  if (password.length < 8 || password.length > 128) {
    return 'Password must be 8-128 characters'
  }
  if (inviteCode.length > 64) {
    return 'Invalid invite code'
  }
  return null
}

function addDays(base: Date, days: number): string {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000).toISOString()
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return base64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value))))
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false
  let difference = 0
  for (let index = 0; index < left.length; index += 1) {
    difference |= left.charCodeAt(index) ^ right.charCodeAt(index)
  }
  return difference === 0
}

async function makeClaimToken(claimId: string, secret: string): Promise<string> {
  return `${claimId}.${await hmac(claimId, secret)}`
}

async function readClaimToken(token: unknown, secret: string): Promise<string | null> {
  if (typeof token !== 'string' || token.length > 160) return null
  const separator = token.lastIndexOf('.')
  if (separator < 1) return null
  const claimId = token.slice(0, separator)
  const signature = token.slice(separator + 1)
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(claimId)) return null
  return constantTimeEqual(signature, await hmac(claimId, secret)) ? claimId : null
}

function csvCell(value: unknown): string {
  let text = value == null ? '' : String(value)
  if (/^[=+\-@]/.test(text)) text = `'${text}`
  return `"${text.replace(/"/g, '""')}"`
}

function inviteError(error: unknown): { error: string; reason: string; status: 400 | 404 | 409 } | null {
  const message = error instanceof Error ? error.message : String(error)
  if (message.includes('invite_invalid')) {
    return { error: 'Invalid invite code', reason: 'invite_invalid', status: 404 }
  }
  if (
    message.includes('NOT NULL constraint failed: user_invites.invite_code') ||
    message.includes('UNIQUE constraint failed: user_invites')
  ) {
    return { error: 'Invite code has already been used', reason: 'invite_exhausted', status: 409 }
  }
  return null
}

async function issueToken(userId: number, secret: string): Promise<string> {
  return sign({
    user_id: userId,
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
  }, secret)
}

async function findInvite(db: D1Database, code: string): Promise<Invite | null> {
  return db.prepare(
    'SELECT duration_days, max_uses, used_count FROM invite_codes WHERE code = ?'
  ).bind(code).first<Invite>()
}

app.get('/api/health', (c) => c.json({ ok: true }))

app.get('/invite', (c) => c.html(claimPage))
app.get('/invite/', (c) => c.redirect('/invite', 308))
app.get('/invite/admin', (c) => c.html(adminPage))
app.get('/invite/qr.svg', (c) => c.body(claimQrSvg, 200, {
  'Content-Type': 'image/svg+xml; charset=utf-8',
  'Cache-Control': 'public, max-age=86400',
  'Content-Disposition': 'inline; filename="invite-claim-qr.svg"',
}))

app.post('/api/invite/claim', async (c) => {
  if (!c.env.CLAIM_SECRET) return c.json({ error: '领取服务尚未配置' }, 503)
  const body = await c.req.json().catch(() => ({})) as Record<string, unknown>
  const suppliedClaimId = await readClaimToken(body.claim_token, c.env.CLAIM_SECRET)
  const claimId = suppliedClaimId || crypto.randomUUID()
  const now = new Date().toISOString()

  let claim = await c.env.DB.prepare(
    `SELECT c.invite_code, c.claimed_at, c.last_seen_at, i.used_count
     FROM invite_claims c
     JOIN invite_codes i ON i.code = c.invite_code
     WHERE c.claim_id = ?`
  ).bind(claimId).first<ClaimRecord>()

  if (claim) {
    await c.env.DB.prepare(
      'UPDATE invite_claims SET last_seen_at = ? WHERE claim_id = ?'
    ).bind(now, claimId).run()
  } else {
    try {
      claim = await c.env.DB.prepare(
        `INSERT INTO invite_claims (claim_id, invite_code, claimed_at, last_seen_at)
         SELECT ?, i.code, ?, ?
         FROM invite_codes i
         WHERE i.code LIKE ?
           AND i.duration_days = 30
           AND i.max_uses = 1
           AND i.used_count = 0
           AND NOT EXISTS (
             SELECT 1 FROM invite_claims c WHERE c.invite_code = i.code
           )
         ORDER BY i.code
         LIMIT 1
         RETURNING invite_code, claimed_at, last_seen_at, 0 AS used_count`
      ).bind(claimId, now, now, `${INVITE_CAMPAIGN_PREFIX}%`).first<ClaimRecord>()
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!message.includes('UNIQUE constraint failed')) throw error
      claim = await c.env.DB.prepare(
        `SELECT c.invite_code, c.claimed_at, c.last_seen_at, i.used_count
         FROM invite_claims c
         JOIN invite_codes i ON i.code = c.invite_code
         WHERE c.claim_id = ?`
      ).bind(claimId).first<ClaimRecord>()
    }
  }

  c.header('Cache-Control', 'no-store')
  if (!claim) return c.json({ error: '本批邀请码已经领取完毕' }, 410)
  return c.json({
    success: true,
    invite_code: claim.invite_code,
    claimed_at: claim.claimed_at,
    redeemed: claim.used_count > 0,
    claim_token: await makeClaimToken(claimId, c.env.CLAIM_SECRET),
  })
})

const adminGuard = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  const authorization = c.req.header('Authorization') || ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : ''
  if (!c.env.INVITE_ADMIN_TOKEN || !constantTimeEqual(token, c.env.INVITE_ADMIN_TOKEN)) {
    c.header('Cache-Control', 'no-store')
    return c.json({ error: 'Unauthorized' }, 401)
  }
  await next()
}

app.use('/api/invite/admin/*', adminGuard)

app.get('/api/invite/admin/stats', async (c) => {
  const stats = await c.env.DB.prepare(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN i.used_count = 0 AND c.claim_id IS NULL THEN 1 ELSE 0 END) AS unissued,
       SUM(CASE WHEN i.used_count = 0 AND c.claim_id IS NOT NULL THEN 1 ELSE 0 END) AS issued_unused,
       SUM(CASE WHEN i.used_count > 0 THEN 1 ELSE 0 END) AS redeemed
     FROM invite_codes i
     LEFT JOIN invite_claims c ON c.invite_code = i.code
     WHERE i.code LIKE ?`
  ).bind(`${INVITE_CAMPAIGN_PREFIX}%`).first<Record<string, number>>()
  c.header('Cache-Control', 'no-store')
  return c.json({
    total: stats?.total || 0,
    unissued: stats?.unissued || 0,
    issued_unused: stats?.issued_unused || 0,
    redeemed: stats?.redeemed || 0,
  })
})

app.get('/api/invite/admin/claims', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT
       c.invite_code,
       c.claimed_at,
       c.last_seen_at,
       CASE WHEN i.used_count > 0 THEN 1 ELSE 0 END AS redeemed,
       u.username,
       ui.used_at
     FROM invite_claims c
     JOIN invite_codes i ON i.code = c.invite_code
     LEFT JOIN user_invites ui ON ui.invite_code = c.invite_code
     LEFT JOIN users u ON u.id = ui.user_id
     ORDER BY c.claimed_at DESC
     LIMIT 1000`
  ).all()
  c.header('Cache-Control', 'no-store')
  return c.json({ claims: result.results })
})

app.get('/api/invite/admin/export', async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT
       i.code AS invite_code,
       CASE
         WHEN i.used_count > 0 THEN '已注册使用'
         WHEN c.claim_id IS NOT NULL THEN '已发放未注册'
         ELSE '尚未发放'
       END AS status,
       c.claimed_at,
       u.username,
       ui.used_at
     FROM invite_codes i
     LEFT JOIN invite_claims c ON c.invite_code = i.code
     LEFT JOIN user_invites ui ON ui.invite_code = i.code
     LEFT JOIN users u ON u.id = ui.user_id
     WHERE i.code LIKE ?
     ORDER BY i.code`
  ).bind(`${INVITE_CAMPAIGN_PREFIX}%`).all<Record<string, unknown>>()
  const lines = [
    ['invite_code', 'status', 'claimed_at', 'username', 'used_at'].map(csvCell).join(','),
    ...result.results.map((row) => [row.invite_code, row.status, row.claimed_at, row.username, row.used_at].map(csvCell).join(',')),
  ]
  return c.body(`\uFEFF${lines.join('\n')}\n`, 200, {
    'Content-Type': 'text/csv; charset=utf-8',
    'Content-Disposition': 'attachment; filename="invite-status.csv"',
    'Cache-Control': 'no-store',
  })
})

app.post('/api/register', async (c) => {
  try {
    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400)

    const username = typeof body.username === 'string' ? body.username.trim() : body.username
    const password = body.password
    const inviteCode = normalizeInviteCode(body.invite_code)
    const validationError = validateRegistrationInput(username, password, inviteCode)
    if (validationError) return c.json({ error: validationError }, 400)
    if (!c.env.JWT_SECRET) return c.json({ error: 'Server configuration error' }, 500)

    const invite = await findInvite(c.env.DB, inviteCode)
    if (!invite) return c.json({ error: 'Invalid invite code', reason: 'invite_invalid' }, 404)
    if (invite.max_uses !== -1 && invite.used_count >= invite.max_uses) {
      return c.json({ error: 'Invite code has already been used', reason: 'invite_exhausted' }, 409)
    }

    const now = new Date()
    const expireTime = addDays(now, invite.duration_days)
    const salt = generateSalt()
    const hash = await hashPassword(password as string, salt)
    const claimToken = crypto.randomUUID()

    await c.env.DB.batch([
      c.env.DB.prepare(
        'INSERT INTO users (username, password_hash, vip_expire_time) VALUES (?, ?, ?)'
      ).bind(username, `${salt}:${hash}`, expireTime),
      c.env.DB.prepare(
        `UPDATE invite_codes
         SET used_count = used_count + 1, last_claim_token = ?
         WHERE code = ? AND (max_uses = -1 OR used_count < max_uses)`
      ).bind(claimToken, inviteCode),
      c.env.DB.prepare(
        `INSERT INTO user_invites (user_id, invite_code, used_at)
         VALUES (
           (SELECT id FROM users WHERE username = ?),
           (SELECT code FROM invite_codes WHERE code = ? AND last_claim_token = ?),
           ?
         )`
      ).bind(username, inviteCode, claimToken, now.toISOString()),
    ])

    const user = await c.env.DB.prepare(
      'SELECT id, username, vip_expire_time FROM users WHERE username = ?'
    ).bind(username).first<UserSubscription>()
    if (!user) throw new Error('Failed to retrieve inserted user')

    return c.json({
      success: true,
      token: await issueToken(user.id, c.env.JWT_SECRET),
      user,
    }, 201)
  } catch (error) {
    const redemptionError = inviteError(error)
    if (redemptionError) {
      return c.json({ error: redemptionError.error, reason: redemptionError.reason }, redemptionError.status)
    }
    const message = error instanceof Error ? error.message : String(error)
    if (message.includes('UNIQUE constraint failed: users.username')) {
      return c.json({ error: 'Username already exists', reason: 'username_exists' }, 409)
    }
    console.error('Register error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

app.post('/api/login', async (c) => {
  try {
    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400)
    const username = typeof body.username === 'string' ? body.username.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!username || !password) return c.json({ error: 'Missing username or password' }, 400)
    if (!c.env.JWT_SECRET) return c.json({ error: 'Server configuration error' }, 500)

    const user = await c.env.DB.prepare(
      'SELECT id, username, password_hash, vip_expire_time FROM users WHERE username = ?'
    ).bind(username).first<UserSubscription & { password_hash: string }>()
    if (!user) return c.json({ error: 'Invalid username or password' }, 401)

    const [salt, storedHash] = user.password_hash.split(':')
    if (!salt || !storedHash || await hashPassword(password, salt) !== storedHash) {
      return c.json({ error: 'Invalid username or password' }, 401)
    }

    return c.json({
      success: true,
      token: await issueToken(user.id, c.env.JWT_SECRET),
      user: {
        id: user.id,
        username: user.username,
        vip_expire_time: user.vip_expire_time,
      },
    })
  } catch (error) {
    console.error('Login error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

const protectedRoute = async (c: Context<{ Bindings: Bindings }>, next: Next) => {
  if (!c.env.JWT_SECRET) return c.json({ error: 'Server configuration error' }, 500)
  return jwt({ secret: c.env.JWT_SECRET, alg: 'HS256' })(c, next)
}

app.use('/api/check-permission', protectedRoute)
app.use('/api/redeem-invite', protectedRoute)

app.get('/api/check-permission', async (c) => {
  try {
    const payload = c.get('jwtPayload') as JwtPayload
    const user = await c.env.DB.prepare(
      'SELECT id, username, vip_expire_time FROM users WHERE id = ?'
    ).bind(payload.user_id).first<UserSubscription>()
    if (!user) return c.json({ allowed: false, reason: 'user_not_found' }, 404)

    const allowed = Date.now() <= new Date(user.vip_expire_time).getTime()
    return c.json({
      allowed,
      reason: allowed ? undefined : 'expired',
      vip_expire_time: user.vip_expire_time,
    })
  } catch (error) {
    console.error('Check permission error:', error)
    return c.json({ allowed: false, reason: 'internal_error' }, 500)
  }
})

app.post('/api/redeem-invite', async (c) => {
  try {
    const body = await c.req.json().catch(() => null) as Record<string, unknown> | null
    if (!body) return c.json({ error: 'Invalid JSON body' }, 400)
    const inviteCode = normalizeInviteCode(body.invite_code)
    if (!inviteCode || inviteCode.length > 64) return c.json({ error: 'Invalid invite code' }, 400)

    const payload = c.get('jwtPayload') as JwtPayload
    const [invite, user] = await Promise.all([
      findInvite(c.env.DB, inviteCode),
      c.env.DB.prepare(
        'SELECT id, username, vip_expire_time FROM users WHERE id = ?'
      ).bind(payload.user_id).first<UserSubscription>(),
    ])
    if (!user) return c.json({ error: 'User not found', reason: 'user_not_found' }, 404)
    if (!invite) return c.json({ error: 'Invalid invite code', reason: 'invite_invalid' }, 404)
    if (invite.max_uses !== -1 && invite.used_count >= invite.max_uses) {
      return c.json({ error: 'Invite code has already been used', reason: 'invite_exhausted' }, 409)
    }

    const now = new Date()
    const currentExpiry = new Date(user.vip_expire_time)
    const base = Number.isNaN(currentExpiry.getTime()) || currentExpiry < now ? now : currentExpiry
    const expireTime = addDays(base, invite.duration_days)
    const claimToken = crypto.randomUUID()

    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE invite_codes
         SET used_count = used_count + 1, last_claim_token = ?
         WHERE code = ? AND (max_uses = -1 OR used_count < max_uses)`
      ).bind(claimToken, inviteCode),
      c.env.DB.prepare(
        `INSERT INTO user_invites (user_id, invite_code, used_at)
         VALUES (
           ?,
           (SELECT code FROM invite_codes WHERE code = ? AND last_claim_token = ?),
           ?
         )`
      ).bind(user.id, inviteCode, claimToken, now.toISOString()),
      c.env.DB.prepare(
        'UPDATE users SET vip_expire_time = ? WHERE id = ?'
      ).bind(expireTime, user.id),
    ])

    return c.json({
      success: true,
      user: { id: user.id, username: user.username, vip_expire_time: expireTime },
    })
  } catch (error) {
    const redemptionError = inviteError(error)
    if (redemptionError) {
      return c.json({ error: redemptionError.error, reason: redemptionError.reason }, redemptionError.status)
    }
    console.error('Redeem invite error:', error)
    return c.json({ error: 'Internal server error' }, 500)
  }
})

export default app
