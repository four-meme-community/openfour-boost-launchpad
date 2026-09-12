# OpenFour Boost — Backend (BFF)

Dual-channel access (no RSA):

| Channel | Prefix | Use |
|---------|--------|-----|
| Partner public | `/meme-api/api/v1/**` | List / detail / address / config… with `meme-api-key` only |
| Official Web (meme-launcher) | `/meme-api/v1/private/**` etc. | Login, profile, invite rebates, OpenFour create |

Explicitly rejected: `POST .../token/login/record`.

```bash
cp .env.example .env   # set MEME_API_KEY
pnpm install && pnpm dev
pnpm smoke
```
