# Authentication Worker

Cloudflare Worker and D1-backed invitation subscription service.

```bash
pnpm install
pnpm exec wrangler d1 migrations apply auth-db --remote
pnpm run deploy
```

Invitation codes are stored uppercase. A single-use 30-day code uses
`duration_days = 30`, `max_uses = 1`, and `used_count = 0`.
