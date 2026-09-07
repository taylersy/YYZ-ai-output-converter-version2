import { Hono, type Context, type Next } from 'hono'
import { cors } from 'hono/cors'
import { jwt, sign } from 'hono/jwt'

type Bindings = {
  DB: D1Database
  JWT_SECRET: string
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
