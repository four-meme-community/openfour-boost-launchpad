# OpenFour Boost

开源的 **OpenFour-based Launchpad** 解决方案 **「OpenFour Boost」**，**单仓库**包含 `frontend/`（Next.js）与 `backend/`（Hono BFF）。可直接部署上线，也可二次开发定制。覆盖发币、交易、税费模板、推荐与分红；业务 API 走 Four.meme 合作方通道，链上交互走 OpenFour。

在 OpenFour Boost 方案下创建的 token，都将经由 OpenFour 协议在各大交易平台（Binance Wallet / GMGN / Debot / Fomo 等）呈现与交易。Boost 伙伴运营者可分享其一定比例的**内盘（联合曲线）交易手续费**。

[English](./README.md)

| 项 | 说明 |
|----|------|
| 伙伴模型 | **一部署对应一把 `MEME_API_KEY`** |
| 安全边界 | 浏览器**只**访问 BFF；合作方 API Key **仅**在服务端注入 |
| 链 | BSC、Robinhood Chain（主网 / 测试网由环境切换） |
| 许可 | MIT — 见 [LICENSE](./LICENSE) |

---

## 目录

1. [概述](#概述)
2. [功能](#功能)
3. [架构](#架构)
4. [仓库结构](#仓库结构)
5. [环境要求](#环境要求)
6. [配置](#配置)
7. [安装](#安装)
8. [使用](#使用)
9. [调试](#调试)
10. [Docker](#docker)
11. [一键部署到 Railway](#一键部署到-railway)
12. [二次开发](#二次开发)
13. [相关文档](#相关文档)
14. [许可](#许可)

---

## 概述

OpenFour Boost 是开源的 OpenFour-based Launchpad 解决方案。伙伴可以：

- **直接部署** — 配置品牌与环境变量即可上线
- **二次开发** — 扩展页面、路由与 BFF 白名单，定制自有体验
- **协议分发与手续费** — 方案下创建的 token 经 OpenFour 协议在 Binance Wallet / GMGN / Debot / Fomo 等平台呈现与交易；Boost 伙伴运营者可按约定比例分享内盘（联合曲线）交易手续费

产品通过「薄前端 + 受控 BFF」避免密钥进入浏览器：

- HTTP 与行情流经 BFF（路径白名单反代 + Key 注入）
- 钱包、发币、买卖、Zap、税费金库等通过 wagmi / viem 直连公共 RPC
- 合约与上游平台本体**不在本仓库**；本仓只负责展示与编排

---

## 功能

### 前端（`frontend/`）

| 能力 | 说明 |
|------|------|
| 首页列表 | `/`、`/[locale]` |
| 发币 | `/create` — **普通模式** / **税费模式**；OpenFour 模板；Custom Royalty、Unverified Royalty（ForwardVault） |
| 代币详情 | `/token/[address]` — 图表、成交、持有人、买卖（含 Zap） |
| 税费详情 | `/token/[address]/tax` |
| 推荐 | `/referral` |
| 分红 | `/dividends` — 跨币领取 |
| 钱包登录 | 连接钱包后自动拉起签名登录 |
| 多语言 | `en` / `zh-TW` / `ja` / `vi` |
| 切链 | BSC ↔ Robinhood（cookie + BFF 配置） |

### 后端（`backend/`）

| 路由 | 作用 |
|------|------|
| `GET /v1/health` | 存活探针 |
| `GET /v1/config` | 公开品牌、启用链、发币 preset（**无密钥**） |
| `ALL /v1/proxy/*` | 白名单反代上游 API；partner 路径注入 `meme-api-key` |
| `GET /v1/tokens` | 基于合作方 search 的列表封装 |
| `/v1/stream/bars` · `/fills` · `/hub` | 行情流中继（前端不得直连上游 WS） |

Proxy 拒绝路径穿越与绝对 URL（防 SSRF）。生产 CORS 为精确 Origin 列表（禁用 `*`）。

---

## 架构

```text
Browser
  └─ frontend/                 Next.js（品牌 UI）
       ├─ HTTP / SSE ────────► backend/（Hono BFF）
       │                         ├─ /v1/config
       │                         ├─ /v1/health
       │                         ├─ /v1/proxy/*
       │                         ├─ /v1/tokens
       │                         └─ /v1/stream/*
       └─ RPC / 钱包 ──────────► BSC / Robinhood（OpenFour）
```

| 路径 | 职责 |
|------|------|
| `backend/src/config` | Zod 校验环境变量；公开站点与链配置 |
| `backend/src/middleware` | requestId、访问日志、错误处理 |
| `backend/src/lib` | 路径白名单、上游客户端（Key 注入）、流中继 |
| `backend/src/routes` | health / config / proxy / tokens / stream |
| `frontend/src/app` | App Router 页面 |
| `frontend/src/components` | 发币、交易、税费、推荐等 UI |
| `frontend/src/lib` | BFF 客户端、链、OpenFour、税费、Zap、wagmi |

---

## 仓库结构

```text
.
├── frontend/                 Next.js 15（standalone）
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
├── fourmeme-api-doc-v2.md    上游合作方 API 参考
├── README.md
└── README.zh-CN.md
```

---

## 环境要求

- Node.js **≥ 22**
- **pnpm**（建议 `corepack enable`）
- Four.meme 发放的合作方 **`MEME_API_KEY`**
- 支持注入式 EIP-1193 的浏览器钱包（如 MetaMask）

---

## 配置

### 后端 — `backend/.env`

从 `backend/.env.example` 复制。

| 变量 | 说明 |
|------|------|
| `MEME_WEB_BASE_URL` | 上游 HTTP API origin（如 `https://four.meme`） |
| `MEME_API_KEY` | 合作方 Key — **禁止**写入前端或 `/v1/config` |
| `MEME_WS_URL` | 上游行情 WebSocket（仅 BFF 使用） |
| `MEME_WEB_TIMEOUT_MS` | 出站超时（毫秒） |
| `CORS_ORIGINS` | 逗号分隔 Origin，须包含前端 Origin |
| `SITE_NAME` / `SITE_TAGLINE` / `SITE_LOGO_URL` / `SITE_PRIMARY_COLOR` | 公开品牌 |
| `ENABLED_CHAINS` | 目录 key：`bsc`、`bsc-testnet`、`robinhood`、`robinhood-testnet`；**同族主网与测试网勿混部** |
| `DEFAULT_CHAIN` | 默认链（须在启用列表内） |
| `CREATE_PRESETS` | 按链 OpenFour 发币模板 ID：`key:id,id;key:id` |

示例：

```bash
ENABLED_CHAINS=bsc,robinhood
DEFAULT_CHAIN=bsc
CREATE_PRESETS=bsc:1778027615733;robinhood:1778027615741,1778027615742
CORS_ORIGINS=http://localhost:3001,http://localhost:3000
```

### 前端 — `frontend/.env.local`

从 `frontend/.env.example` 复制。**不要**配置任何 API Key。

| 变量 | 说明 |
|------|------|
| `NEXT_PUBLIC_BFF_URL` | BFF 根地址（如 `http://localhost:8787`） |
| `NEXT_PUBLIC_MODE` | `PROD` → BSC `56` + Robinhood `4663`；否则测试网 `97` / `46630` |
| `NEXT_PUBLIC_OPEN_FOUR_TEMPLATE_ID` | BSC 兜底 template；优先使用 BFF `/v1/config` 的 presets |
| `NEXT_PUBLIC_FILE_HOST` | 图片 CDN |
| `NEXT_PUBLIC_ZAP_ROUTER_ADDRESS` | 可选；省略则读 `OpenFourCore.zapRouter()` |
| `NEXT_PUBLIC_ZAP_DEBUG` | Zap 调试日志 |
| `NEXT_PUBLIC_RPC_URLS` | 可选，逗号分隔覆盖 BSC RPC |
| `NEXT_PUBLIC_ROBINHOOD_RPC_URLS` | 可选，覆盖 Robinhood RPC |

> `NEXT_PUBLIC_*` 在 **`next build` 时打进包**。生产镜像须以 Docker build-arg 传入。

---

## 安装

```bash
# 后端
cp backend/.env.example backend/.env
# 编辑 backend/.env（MEME_API_KEY、MEME_WEB_BASE_URL、CORS_ORIGINS 等）
cd backend && pnpm install && pnpm dev
# → http://localhost:8787/v1/health

# 前端（另开终端）
cp frontend/.env.example frontend/.env.local
# 确认 NEXT_PUBLIC_BFF_URL=http://localhost:8787
cd frontend && pnpm install && pnpm dev
# → http://localhost:3001
```

BFF 冒烟：

```bash
cd backend && pnpm smoke
```

类型检查：

```bash
cd backend && pnpm typecheck
cd frontend && pnpm typecheck
```

---

## 使用

1. 打开前端（默认 `http://localhost:3001`）。
2. 在页头切换网络（BSC / Robinhood）与语言。连接钱包后会自动拉起签名登录。
3. **发币** — `/create`：选择普通模式或税费模式 → 填写资料 → 连接钱包提交。
4. **交易** — 进入代币详情 → 使用交易面板（联合曲线 / Zap）。
5. **税费模式** — 配置买卖税率与分配。Unverified Royalty 需链上已激活 ForwardVault，并填写可信模板地址。
6. **推荐 / 分红** — 需已登录（经 BFF 私有路由）。

上线前核对：

- [ ] `MEME_API_KEY` 仅存在于 BFF
- [ ] `CORS_ORIGINS` 仅为真实前端 Origin
- [ ] `NEXT_PUBLIC_MODE` 与 `ENABLED_CHAINS` 主/测一致
- [ ] `CREATE_PRESETS` 与目标链 OpenFour 模板一致

---

## 调试

| 现象 | 排查 |
|------|------|
| BFF 无法启动 | 启动日志；Zod 会打印非法 env 字段 |
| 前端连不上 BFF | `NEXT_PUBLIC_BFF_URL`、CORS、防火墙 |
| 列表为空 | `pnpm smoke`；Key 与 `MEME_WEB_BASE_URL`；Network 中 `/v1/tokens`、`/v1/proxy/...` |
| 钱包切链失败 | RPC 可达性；可选 RPC 覆盖 |
| Zap / 交易失败 | 非 `PROD` 默认开 Zap debug；控制台；合约部署地址 |
| Unverified Royalty 不出现 | TaxVaultRegistry 是否已激活 `SafuSkill.ForwardVault.v1` |
| K 线无数据 | `MEME_WS_URL`；`/v1/stream/hub` |
| Proxy 403 | 路径不在白名单或被显式拒绝 |

探针：

```bash
curl -s http://localhost:8787/v1/health
curl -s http://localhost:8787/v1/config | jq .
curl -s 'http://localhost:8787/v1/tokens?pageIndex=1&pageSize=10' | jq .
```

上游请求形态见 [fourmeme-api-doc-v2.md](./fourmeme-api-doc-v2.md)。

---

## Docker

先准备 `backend/.env`：

```bash
docker compose up --build
```

| 服务 | 端口 | 说明 |
|------|------|------|
| `backend` | `8787` | 读取 `backend/.env`；`HOST=0.0.0.0` |
| `frontend` | `3000` | build-arg 注入 `NEXT_PUBLIC_*` |

`docker-compose.yml` 默认 `NEXT_PUBLIC_BFF_URL=http://localhost:8787`（浏览器可达）。线上请改为对外 BFF URL。

单独构建：

```bash
docker build -t openfour-boost-bff ./backend
docker run --env-file backend/.env -p 8787:8787 openfour-boost-bff

docker build -t openfour-boost-web ./frontend \
  --build-arg NEXT_PUBLIC_BFF_URL=https://bff.example.com \
  --build-arg NEXT_PUBLIC_MODE=PROD
docker run -p 3000:3000 openfour-boost-web
```

注意：

1. 前端镜像构建时缺少 `NEXT_PUBLIC_BFF_URL` 会直接失败。
2. `CORS_ORIGINS` 必须包含用户访问的前端 Origin。
3. 浏览器中的 BFF 地址须对用户可达（不要用仅容器内网的服务名），除非同源反代。

---

## 一键部署到 Railway

推荐拆成两个服务（各自用对应目录的 `Dockerfile`）：

1. **新建 Project** → 从 GitHub 导入本仓库。
2. **Backend 服务**
   - Root Directory：`backend`
   - 在 Variables 填入 `backend/.env.example` 中的项（至少 `MEME_API_KEY`、`MEME_WEB_BASE_URL`、`MEME_WS_URL`）
   - 部署后记下公网域名，例如 `https://xxx.up.railway.app`
3. **Frontend 服务**
   - Root Directory：`frontend`
   - Variables / Build 中设置（`NEXT_PUBLIC_*` 须在 **build** 阶段可用）：
     - `NEXT_PUBLIC_BFF_URL` = 上一步 Backend 公网 URL
     - `NEXT_PUBLIC_MODE` = `PROD`（或测试网环境对应值）
   - 按需补充 `NEXT_PUBLIC_FILE_HOST`、`NEXT_PUBLIC_OPEN_FOUR_TEMPLATE_ID` 等
4. **回写 Backend**
   - `CORS_ORIGINS` = Frontend 公网 Origin（可多个，逗号分隔）
   - `HOST=0.0.0.0`；端口用 Railway 注入的 `PORT` 即可
5. 重新 Deploy Frontend（若先部署时 BFF URL 尚未确定）。

生成域名可在 Railway 服务 Settings → Networking 中查看或绑定自定义域名。

---

## 二次开发

### 原则

1. **密钥留在服务端** — 任何需要 `meme-api-key` 的调用放在 BFF（`/v1/proxy` 或专用路由）。
2. **白名单扩权要克制** — 修改 `backend/src/lib/path-allowlist.ts` 会扩大 SSRF 与隐私面。
3. **链配置走环境变量** — 用 `ENABLED_CHAINS` / `CREATE_PRESETS`，避免在 UI 写死部署差异。
4. **可修改 Boost 视觉体系** — 主题变量见 `frontend/src/lib/theme.ts` 与 `globals.css`。

### 常见扩展点

| 目标 | 从哪改 |
|------|--------|
| 品牌文案 / Logo / 色 | `backend/.env` 的 `SITE_*`；CSS 变量 |
| 新语言 | `frontend/src/i18n/translations.ts` + 语言切换 |
| 新页面 | `frontend/src/app/...`；需上游 HTTP 时加 BFF 路由或 proxy 前缀 |
| 新合作方接口 | 白名单 + `frontend/src/lib/meme-api.ts` / `bff.ts` |
| 税费金库模板 | 通过 ForwardVault 定制带开发者佣金的多种金库 |
| 其他特色功能 | 例如社区投票 / 论坛 / 积分等 |

### 前端模块

| 区域 | 职责 |
|------|------|
| `src/lib/bff.ts` | BFF HTTP 客户端 |
| `src/lib/open-four*.ts` | 发币与 ABI 编码 |
| `src/lib/tax-*.ts` | 税费 API、链上、vault |
| `src/lib/zap-*.ts` | Zap 路由与交易 |
| `src/lib/wagmi.ts` | 钱包与链 |
| `src/components/create-*.tsx` | 发币 / 税费表单 |
| `src/components/trade-*.tsx` | 交易 UI |

### 后端模块

| 区域 | 职责 |
|------|------|
| `src/config` | env、链、create presets |
| `src/middleware` | requestId、日志、错误 |
| `src/lib` 出站客户端 | 上游 HTTP 客户端与 Key 注入 |
| `src/routes/*` | HTTP 契约 |

建议流程：改配置 → `pnpm smoke` → 本地双进程联调 → Docker 构建验证生产 `NEXT_PUBLIC_*`。

---

## 相关文档

- [README.md](./README.md) — English
- [backend/README.md](./backend/README.md) — BFF 通道说明
- [frontend/README.md](./frontend/README.md) — 前端边界说明
- [fourmeme-api-doc-v2.md](./fourmeme-api-doc-v2.md) — 上游合作方 API 参考

---

## 许可

MIT — 见 [LICENSE](./LICENSE)。
