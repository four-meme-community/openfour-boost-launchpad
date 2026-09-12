# OpenFour Boost

Thin white-label Boost stack: **one repo** with `frontend/` (Next.js) + `backend/` (Hono BFF).

- **Out of scope for now:** meme-web / contracts
- **No** tenantId / launchpadId; tenant = this deploy’s `MEME_API_KEY` (`meme-api-key`)
- Browser talks **only** to the BFF; apiKey is injected **only** on the BFF server

## Architecture

```text
Browser
  └─ frontend/          Next.js thin shell (branding + pages)
       └─ backend/      Hono BFF
            ├─ /v1/config   Public branding (no secrets)
            ├─ /v1/health   Liveness probe
            ├─ /v1/proxy/*  Allowlist → meme-web + inject meme-api-key
            └─ /v1/tokens   Placeholder (until upstream apiKey filtering)
                 └─ meme-web (existing service)
```

### Module responsibilities

| Path | Responsibility |
|------|----------------|
| `backend/src/config` | Zod-validate env; export public site config |
| `backend/src/middleware` | requestId, access log, error handling |
| `backend/src/lib` | Path allowlist, meme-web outbound client (key injection) |
| `backend/src/routes` | HTTP contracts (health / config / proxy / tokens) |
| `frontend/src/lib` | BFF client + theme only |
| `frontend/src/app` | Pages and layout |

### Security boundary (summary)

1. `MEME_API_KEY` must never appear in `NEXT_PUBLIC_*` or `/v1/config`
2. Proxy allows prefix list only; reject `..` / absolute URLs (SSRF guard)
3. CORS Origin exact allowlist; disable `*` in production
4. One deploy = one key; multi-tenant = multiple env / domains, not a business table

## Quick start

```bash
# Backend
cp backend/.env.example backend/.env   # set MEME_API_KEY / MEME_WEB_BASE_URL
cd backend && pnpm install && pnpm dev

# Frontend (separate terminal)
cp frontend/.env.example frontend/.env.local
cd frontend && pnpm install && pnpm dev
```

- Web: http://localhost:3000  
- BFF: http://localhost:8787/v1/health  

Or: `docker compose up --build` (prepare `backend/.env` first).

## Later (intentionally deferred)

- [ ] Implement `GET /v1/tokens` once meme-web exposes apiKey-scoped token lists
- [ ] Port create / trade pages from meme-launcher into `frontend`
- [ ] Community / voting (Hono-owned modules; still isolated by deploy-level apiKey)

## License

MIT — see [LICENSE](./LICENSE)
