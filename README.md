# OpenFour Boost

Open-source **OpenFour-based Launchpad** solution **OpenFour Boost**, in **one repository**: `frontend/` (Next.js) + `backend/` (Hono BFF). Deploy as-is under your brand, or fork and customize. Covers token creation, trading, tax templates, referrals, and dividends. Business APIs use the Four.meme partner channel; on-chain flows use OpenFour.

Tokens created under the OpenFour Boost solution are surfaced and traded via the OpenFour protocol across major trading platforms (Binance Wallet / GMGN / Debot / Fomo, and more). Boost partner operators can share a portion of the **bonding-curve (inner market) trading fees**.

[中文文档](./README.zh-CN.md)

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new)

| Item | Detail |
|------|--------|
| Partner model | **One deploy, one `MEME_API_KEY`** |
| Security boundary | Browser talks **only** to the BFF; the partner API key is injected **only** on the server |
| Chains | BSC and Robinhood Chain (mainnet / testnet via env) |
| License | MIT — see [LICENSE](./LICENSE) |

---

## Table of contents

1. [Overview](#overview)
2. [Features](#features)
3. [Architecture](#architecture)
4. [Repository layout](#repository-layout)
5. [Requirements](#requirements)
6. [Configuration](#configuration)
7. [Installation](#installation)
8. [Usage](#usage)
9. [Debugging](#debugging)
10. [Docker](#docker)
11. [One-click deploy on Railway](#one-click-deploy-on-railway)
12. [Extending the product](#extending-the-product)
13. [Related documents](#related-documents)
14. [License](#license)

---

## Overview

OpenFour Boost is an open-source OpenFour-based Launchpad solution. Partners can:

- **Ship quickly** — deploy the stack with branding and env config
- **Customize** — extend UI, routes, and BFF allowlists for secondary development
- **Protocol reach & fees** — tokens created under Boost appear and trade via OpenFour on platforms such as Binance Wallet / GMGN / Debot / Fomo; Boost partner operators share a configured portion of bonding-curve (inner market) trading fees

The product keeps credentials off the browser via a thin client plus a controlled BFF:

- HTTP and market streams go through the BFF (allowlisted proxy + key injection)
- Wallet, create, trade, Zap, and tax-vault flows use wagmi / viem against public RPCs
- Contracts and the upstream platform itself live **outside** this repo; Boost owns presentation and orchestration only

---

## Features

### Frontend (`frontend/`)

| Capability | Notes |
|------------|--------|
| Market home | `/`, `/[locale]` |
| Create | `/create` — **Standard** / **Tax mode**; OpenFour templates; Custom Royalty and Unverified Royalty (ForwardVault) |
| Token detail | `/token/[address]` — chart, fills, holders, buy/sell (incl. Zap) |
| Tax detail | `/token/[address]/tax` |
| Referral | `/referral` |
| Dividends | `/dividends` — cross-token claim |
| Wallet login | Auto sign-in prompt after connecting a wallet |
| i18n | `en` / `zh-TW` / `ja` / `vi` |
| Network switch | BSC ↔ Robinhood (cookie + BFF config) |

### Backend (`backend/`)

| Route | Purpose |
|-------|---------|
| `GET /v1/health` | Liveness |
| `GET /v1/config` | Public branding, enabled chains, create presets (**no secrets**) |
| `ALL /v1/proxy/*` | Allowlisted reverse proxy to the upstream API; injects `meme-api-key` on partner paths |
| `GET /v1/tokens` | Partner search wrapper for listings |
| `/v1/stream/bars` · `/fills` · `/hub` | Market stream relay (browser must not open the upstream WS) |

Proxy rejects path traversal and absolute URLs (SSRF guard). Production CORS is an exact Origin allowlist (`*` disabled).

---

## Architecture

```text
Browser
  └─ frontend/                 Next.js (branded UI)
       ├─ HTTP / SSE ────────► backend/ (Hono BFF)
       │                         ├─ /v1/config
       │                         ├─ /v1/health
       │                         ├─ /v1/proxy/*
       │                         ├─ /v1/tokens
       │                         └─ /v1/stream/*
       └─ RPC / wallet ────────► BSC / Robinhood (OpenFour)
```

| Path | Responsibility |
|------|----------------|
| `backend/src/config` | Zod-validated env; public site + chain config |
| `backend/src/middleware` | requestId, access log, errors |
| `backend/src/lib` | Path allowlist, upstream client (key injection), stream hub |
| `backend/src/routes` | health / config / proxy / tokens / stream |
| `frontend/src/app` | App Router pages |
| `frontend/src/components` | Create, trade, tax, referral UI |
| `frontend/src/lib` | BFF client, chains, OpenFour, tax, Zap, wagmi |

---

## Repository layout

```text
.
├── frontend/                 Next.js 15 (standalone)
│   ├── src/app/
│   ├── src/components/
│   ├── src/lib/
│   ├── src/i18n/
│   ├── Dockerfile
│   └── .env.example
├── backend/                  Hono BFF
│   ├── src/config/
│   ├── src/lib/
│   ├── src/routes/
│   ├── scripts/smoke.ts
│   ├── Dockerfile
│   └── .env.example
├── docker-compose.yml
├── docs/
│   └── fourmeme-api-doc-v2.md    Upstream partner API reference
├── README.md
└── README.zh-CN.md
```

---

## Requirements

- Node.js **≥ 22**
- **pnpm** (recommended: `corepack enable`)
- A partner **`MEME_API_KEY`** from Four.meme
- A browser wallet with an injected EIP-1193 provider (e.g. MetaMask)

---

## Configuration

### Backend — `backend/.env`

Copy from `backend/.env.example`.

| Variable | Description |
|----------|-------------|
| `MEME_WEB_BASE_URL` | Upstream HTTP API origin (e.g. `https://four.meme`) |
| `MEME_API_KEY` | Partner key — **never** put in the frontend or `/v1/config` |
| `FILTER_BY_PARTNER` | Default `true`: home list only shows tokens created under this key; set `false` to disable |
| `MEME_WS_URL` | Upstream market WebSocket (BFF only) |
| `MEME_WEB_TIMEOUT_MS` | Outbound timeout (ms) |
| `CORS_ORIGINS` | Comma-separated Origins; must include the frontend origin |
| `SITE_NAME` / `SITE_TAGLINE` / `SITE_LOGO_URL` / `SITE_PRIMARY_COLOR` | Public branding |
| `ENABLED_CHAINS` | Catalog keys: `bsc`, `bsc-testnet`, `robinhood`, `robinhood-testnet`. Do not mix mainnet and testnet of the same family in one deploy |
| `DEFAULT_CHAIN` | Default catalog key (must be enabled) |
| `CREATE_PRESETS` | Per-chain OpenFour create preset IDs: `key:id,id;key:id` |

Example:

```bash
ENABLED_CHAINS=bsc,robinhood
DEFAULT_CHAIN=bsc
CREATE_PRESETS=bsc:1778027615733;robinhood:1778027615741,1778027615742
CORS_ORIGINS=http://localhost:3001,http://localhost:3000
```

### Frontend — `frontend/.env.local`

Copy from `frontend/.env.example`. **Do not** configure any API key here.

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_BFF_URL` | BFF base URL (e.g. `http://localhost:8787`) |
| `NEXT_PUBLIC_MODE` | `PROD` → BSC `56` + Robinhood `4663`; otherwise testnets `97` / `46630` |
| `NEXT_PUBLIC_OPEN_FOUR_TEMPLATE_ID` | BSC fallback template; prefer presets from BFF `/v1/config` |
| `NEXT_PUBLIC_FILE_HOST` | Image CDN |
| `NEXT_PUBLIC_ZAP_ROUTER_ADDRESS` | Optional; omit to read `OpenFourCore.zapRouter()` |
| `NEXT_PUBLIC_ZAP_DEBUG` | Zap debug logs |
| `NEXT_PUBLIC_RPC_URLS` | Optional comma-separated BSC RPC override |
| `NEXT_PUBLIC_ROBINHOOD_RPC_URLS` | Optional Robinhood RPC override |

> `NEXT_PUBLIC_*` values are **baked in at `next build`**. Pass them as Docker build-args in production images.

---

## Installation

```bash
# Backend
cp backend/.env.example backend/.env
# Edit backend/.env (MEME_API_KEY, MEME_WEB_BASE_URL, CORS_ORIGINS, …)
cd backend && pnpm install && pnpm dev
# → http://localhost:8787/v1/health

# Frontend (second terminal)
cp frontend/.env.example frontend/.env.local
# Confirm NEXT_PUBLIC_BFF_URL=http://localhost:8787
cd frontend && pnpm install && pnpm dev
# → http://localhost:3001
```

Smoke test (BFF):

```bash
cd backend && pnpm smoke
```

Typecheck:

```bash
cd backend && pnpm typecheck
cd frontend && pnpm typecheck
```

---

## Usage

1. Open the frontend (`http://localhost:3001` by default).
2. Switch network (BSC / Robinhood) and language from the header. Connecting a wallet auto-prompts sign-in.
3. **Create** — `/create`: choose Standard or Tax mode → fill metadata → connect wallet and submit.
4. **Trade** — open a token → use the trade panel (bonding curve / Zap when applicable).
5. **Tax mode** — set buy/sell rates and allocation. Unverified Royalty requires an active ForwardVault type on-chain and a trusted template address.
6. **Referral / dividends** — require a signed-in session (via BFF private routes).

Production checklist:

- [ ] `MEME_API_KEY` exists only on the BFF
- [ ] `CORS_ORIGINS` lists only real frontend Origins
- [ ] `NEXT_PUBLIC_MODE` matches `ENABLED_CHAINS` (mainnet vs testnet)
- [ ] `CREATE_PRESETS` match OpenFour templates on the target chains

---

## Debugging

| Symptom | What to check |
|---------|----------------|
| BFF fails to start | Startup logs; Zod prints invalid env fields |
| Frontend cannot reach BFF | `NEXT_PUBLIC_BFF_URL`, CORS, firewall |
| Empty token list | `pnpm smoke`; API key + `MEME_WEB_BASE_URL`; Network tab `/v1/tokens`, `/v1/proxy/...` |
| Wallet chain switch fails | RPC reachability; optional RPC URL overrides |
| Zap / trade failures | Zap debug (on when not `PROD`); console; deployed contract addresses |
| Unverified Royalty missing | TaxVaultRegistry has active `SafuSkill.ForwardVault.v1` |
| Chart empty | `MEME_WS_URL`; `/v1/stream/hub` |
| Proxy 403 | Path outside allowlist or explicitly denied |

Probes:

```bash
curl -s http://localhost:8787/v1/health
curl -s http://localhost:8787/v1/config | jq .
curl -s 'http://localhost:8787/v1/tokens?pageIndex=1&pageSize=10' | jq .
```

Upstream request shapes: [docs/fourmeme-api-doc-v2.md](./docs/fourmeme-api-doc-v2.md).

---

## Docker

Prepare `backend/.env`, then:

```bash
docker compose up --build
```

| Service | Port | Notes |
|---------|------|--------|
| `backend` | `8787` | Uses `backend/.env`; `HOST=0.0.0.0` |
| `frontend` | `3000` | Build-args for `NEXT_PUBLIC_*` |

`docker-compose.yml` defaults `NEXT_PUBLIC_BFF_URL` to `http://localhost:8787` (browser-reachable). In production, set it to your public BFF URL.

Standalone builds:

```bash
docker build -t openfour-boost-bff ./backend
docker run --env-file backend/.env -p 8787:8787 openfour-boost-bff

docker build -t openfour-boost-web ./frontend \
  --build-arg NEXT_PUBLIC_BFF_URL=https://bff.example.com \
  --build-arg NEXT_PUBLIC_MODE=PROD
docker run -p 3000:3000 openfour-boost-web
```

Notes:

1. Frontend image build **fails** if `NEXT_PUBLIC_BFF_URL` is missing.
2. `CORS_ORIGINS` must include the user-facing frontend Origin.
3. The BFF URL in the browser must be reachable by users (not an internal Docker DNS name), unless you terminate TLS and reverse-proxy under the same origin.

---

## One-click deploy on Railway

[![Deploy on Railway](https://railway.com/button.svg)](https://railway.com/new)

Click the button to open Railway’s new-project page, then import this GitHub repo and configure **two services** (each with its own `Dockerfile`) as below:

1. **Create a Project** → Deploy from GitHub repo and select this repository (or open the button above, then pick the repo).
2. **Backend service**
   - Root Directory: `backend`
   - Set Variables from `backend/.env.example` (at least `MEME_API_KEY`, `MEME_WEB_BASE_URL`, `MEME_WS_URL`)
   - After deploy, copy the public URL (e.g. `https://xxx.up.railway.app`)
3. **Frontend service**
   - Root Directory: `frontend`
   - Set Variables so they are available at **build** time (`NEXT_PUBLIC_*` are baked into the client):
     - `NEXT_PUBLIC_BFF_URL` = Backend public URL from step 2
     - `NEXT_PUBLIC_MODE` = `PROD` (or your testnet setting)
   - Optionally set `NEXT_PUBLIC_FILE_HOST`, `NEXT_PUBLIC_OPEN_FOUR_TEMPLATE_ID`, etc.
4. **Update Backend**
   - `CORS_ORIGINS` = Frontend public Origin (comma-separated if multiple)
   - `HOST=0.0.0.0`; listen on Railway’s injected `PORT`
5. Redeploy Frontend if the BFF URL was not ready on the first build.

Public hostnames are under each service’s Settings → Networking (custom domains optional).

---

## Extending the product

### Guidelines

1. **Keep secrets server-side** — any call that needs `meme-api-key` belongs on the BFF (`/v1/proxy` or a dedicated route).
2. **Expand the allowlist carefully** — changes in `backend/src/lib/path-allowlist.ts` widen the SSRF and privacy surface.
3. **Configure chains via env** — use `ENABLED_CHAINS` / `CREATE_PRESETS` instead of hardcoding per-deploy chains in the UI.
4. **Customize Boost visuals** — theme tokens live in `frontend/src/lib/theme.ts` and `globals.css`.

### Common extension points

| Goal | Where to start |
|------|----------------|
| Branding copy / logo / color | `SITE_*` in `backend/.env`; CSS variables |
| New locale | `frontend/src/i18n/translations.ts` + language switcher |
| New page | `frontend/src/app/...`; add BFF route or proxy prefix if upstream HTTP is required |
| New partner endpoints | Allowlist + `frontend/src/lib/meme-api.ts` / `bff.ts` |
| Tax vault templates | Use ForwardVault to customize vaults with developer commission |
| Other featured modules | e.g. community voting / forums / points |

### Frontend map

| Area | Role |
|------|------|
| `src/lib/bff.ts` | BFF HTTP client |
| `src/lib/open-four*.ts` | Create + ABI encoding |
| `src/lib/tax-*.ts` | Tax APIs, on-chain helpers, vaults |
| `src/lib/zap-*.ts` | Zap routing / trades |
| `src/lib/wagmi.ts` | Wallet + chains |
| `src/components/create-*.tsx` | Create / tax forms |
| `src/components/trade-*.tsx` | Trade UI |

### Backend map

| Area | Role |
|------|------|
| `src/config` | Env, chains, create presets |
| `src/middleware` | requestId, logging, errors |
| `src/lib` outbound client | Upstream HTTP client + key injection |
| `src/routes/*` | HTTP surface |

Suggested workflow: adjust env → `pnpm smoke` → run BFF + frontend locally → verify Docker build with production `NEXT_PUBLIC_*`.

---

## Related documents

- [README.zh-CN.md](./README.zh-CN.md) — Chinese
- [backend/README.md](./backend/README.md) — BFF channel notes
- [frontend/README.md](./frontend/README.md) — Frontend boundary notes
- [docs/fourmeme-api-doc-v2.md](./docs/fourmeme-api-doc-v2.md) — Upstream partner API reference

---

## License

MIT — see [LICENSE](./LICENSE).
