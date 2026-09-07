import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const date = new Date().toISOString().slice(0, 10)
const adminToken = randomBytes(32).toString('base64url')
const claimSecret = randomBytes(48).toString('base64url')
const repositoryRoot = resolve(import.meta.dirname, '../..')
const credentialsPath = resolve(repositoryRoot, `invite-manager-credentials-${date}.txt`)

writeFileSync(resolve(repositoryRoot, '.invite-admin-token'), `${adminToken}\n`, { mode: 0o600 })
writeFileSync(resolve(repositoryRoot, '.invite-claim-secret'), `${claimSecret}\n`, { mode: 0o600 })
writeFileSync(credentialsPath, [
  'AI 学术输出格式转换器 - 邀请码管理台',
  '',
  '管理地址：https://yyz-ai-output-conventer-version2.auth.taylersy.com/invite/admin',
  `管理员访问密钥：${adminToken}`,
  '',
  '请勿将本文件或访问密钥发送给领取邀请码的用户。',
].join('\n') + '\n', { mode: 0o600 })

console.log(JSON.stringify({ credentialsPath }))
