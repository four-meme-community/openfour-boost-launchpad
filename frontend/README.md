# OpenFour Boost — Frontend

Thin Next.js shell for OpenFour Boost. The browser talks **only** to this repo’s BFF (`backend/`). Never attach a partner API key in the client.

Full docs: [README.md](../README.md) · [中文](../README.zh-CN.md)

## Boundary

| Path | Responsibility |
|------|----------------|
| `src/app` | Routes and page composition |
| `src/components` | Create / trade / tax / referral UI |
| `src/lib/bff.ts` | BFF client |
| `src/lib/env.ts` | Public `NEXT_PUBLIC_*` only |
| `src/lib/theme.ts` | Branding → CSS variables |
| `src/i18n` | Locales |

## Local start

```bash
cp .env.example .env.local
pnpm install
pnpm dev
# → http://localhost:3001
```

Ensure the BFF is running at `NEXT_PUBLIC_BFF_URL` (default `http://localhost:8787`).
