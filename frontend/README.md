# OpenFour Boost — Frontend

Thin Next.js white-label shell: calls only this repo’s `backend` (BFF), never meme-web directly, never holds `meme-api-key`.

## Responsibility boundary

| Path | Responsibility |
|------|----------------|
| `src/app` | Routes and page composition |
| `src/lib/bff.ts` | BFF client (config / proxy) |
| `src/lib/env.ts` | Public environment variables |
| `src/lib/theme.ts` | Branding → CSS variables |

## Local start

```bash
cp .env.example .env.local
pnpm install
pnpm dev
```

Make sure the BFF is running at `NEXT_PUBLIC_BFF_URL`.
