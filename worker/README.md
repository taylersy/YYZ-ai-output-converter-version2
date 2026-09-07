# Authentication Worker

Cloudflare Worker and D1-backed invitation subscription service.

```bash
pnpm install
pnpm exec wrangler d1 migrations apply auth-db --remote
pnpm run deploy
```

Invitation codes are stored uppercase. A single-use 30-day code uses
`duration_days = 30`, `max_uses = 1`, and `used_count = 0`.

## Invitation distribution site

- Public claim page: `/invite`
- Protected manager: `/invite/admin`
- Downloadable QR code: `/invite/qr.svg`

The Worker requires `CLAIM_SECRET` to sign device claim tokens and
`INVITE_ADMIN_TOKEN` to protect the manager APIs. Store both as Cloudflare
Worker secrets; never commit their values. Claims reserve codes in
`invite_claims`, while registration remains the only action that increments
`invite_codes.used_count`.
