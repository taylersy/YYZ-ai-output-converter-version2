import { mkdirSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import QRCode from 'qrcode'

const url = process.argv[2] || 'https://yyz-ai-output-conventer-version2.auth.taylersy.com/invite'
const outputPath = resolve(import.meta.dirname, '../assets/invite-claim-qr.svg')
mkdirSync(resolve(import.meta.dirname, '../assets'), { recursive: true })

const svg = await QRCode.toString(url, {
  type: 'svg',
  width: 720,
  margin: 3,
  errorCorrectionLevel: 'M',
  color: { dark: '#0B1F35', light: '#FFFFFF' },
})

writeFileSync(outputPath, svg)
console.log(JSON.stringify({ url, outputPath }))
