import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const alphabet = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'
const count = Number.parseInt(process.argv[2] || '1000', 10)
const outputBase = process.argv[3] || `invite-codes-${new Date().toISOString().slice(0, 10)}`
const campaign = (process.argv[4] || 'YYZ1M').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12)

if (!Number.isInteger(count) || count < 1 || count > 100000) {
  throw new Error('count must be an integer between 1 and 100000')
}

function randomSegment(length) {
  const bytes = randomBytes(length)
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('')
}

function createCode() {
  return `${campaign}-${randomSegment(4)}-${randomSegment(4)}-${randomSegment(4)}`
}

const codes = new Set()
while (codes.size < count) codes.add(createCode())

const csvPath = resolve(`${outputBase}.csv`)
const sqlPath = resolve(`${outputBase}.sql`)
const csv = [
  'invite_code,duration_days,max_uses,status',
  ...Array.from(codes, (code) => `${code},30,1,unused`),
].join('\n') + '\n'
const values = Array.from(codes, (code) => `('${code}', 30, 1, 0)`).join(',\n')
const sql = [
  '-- Generated single-use 30-day invitation codes. Keep this file private.',
  'INSERT INTO invite_codes (code, duration_days, max_uses, used_count) VALUES',
  `${values}\nON CONFLICT(code) DO NOTHING;`,
  '',
].join('\n')

writeFileSync(csvPath, csv, { mode: 0o600 })
writeFileSync(sqlPath, sql, { mode: 0o600 })
console.log(JSON.stringify({ count: codes.size, csvPath, sqlPath }))
