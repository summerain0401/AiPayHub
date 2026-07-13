# ⚡ AI-Pay Hub

**AI micropayment gateway** — Let AI agents handle your billing.

A lightweight reverse-proxy middleware that lets AI creators monetize their work with per-use billing. Supports Alipay X402 AI payment, Dify/Coze one-click integration, and dynamic content locking.

## Quick Start

```bash
# Prerequisites: Node.js 20+, Redis, pnpm
bash scripts/dev-setup.sh
pnpm dev
open http://localhost:3000/generator
```

## How It Works

```
Client Request → Gateway Intercept → Create Order → HTTP 402 + Payment URL
                                                           │
User Pays (Alipay X402) ←─────────────────────────────────┘
                                                           │
Webhook Marks PAID → Client Retries (X-Order-Id) → Forward to AI → Stream Response → Delete Order
```

## Core Features

- **One-click gateway**: Generate `Public_Gateway_ID` + `Admin_Secret_Key` instantly
- **X402 protocol**: HTTP 402 Payment Required with Alipay AI Pay
- **Redis state machine**: PENDING → PAID → DELETED lifecycle with Lua atomicity
- **SSE streaming**: Passthrough proxy for Dify/Coze LLM responses
- **Dynamic content lock**: Protect Markdown/Cursor rules behind payment gate
- **Burn-after-read**: Orders deleted after single use — no replay attacks

## API

| Method | Path | Description |
|--------|------|-------------|
| POST | /generate/create | Create gateway |
| ALL | /{gatewayId}/* | Proxy with payment gate |
| GET | /poll/{orderId} | Poll payment status |
| GET | /pay/{orderId} | Payment/X402 link |
| POST | /webhook/alipay | Alipay callback |
| GET | /dash/stats | Dashboard (auth) |
| GET | /schema/{id}/openapi.json | Dify import |

## Tests

```bash
pnpm test  # 22 tests, 4 files
```

## License

MIT
