# OpenFour Boost — Backend (BFF)

Hono BFF in front of the Four.meme partner / official Web APIs. Dual channel (no RSA):

| Channel | Prefix | Use |
|---------|--------|-----|
| Partner public | `/meme-api/api/v1/**` | List / detail / address / config… with `meme-api-key` only |
| Official Web | `/meme-api/v1/private/**` etc. | Login, profile, invite rebates, OpenFour create |

Explicitly rejected: `POST .../token/login/record`.

Full docs: [README.md](../README.md) · [中文](../README.zh-CN.md)

```bash
cp .env.example .env   # set MEME_API_KEY
pnpm install && pnpm dev
pnpm smoke
# → http://localhost:8787/v1/health
```
