# AI-Pay Hub — Deployment Guide

## Requirements

- Node.js >= 20 LTS
- Redis 7
- pnpm
- ngrok (for local webhook testing)

## Environment Variables

```bash
PORT=3000
REDIS_URL=redis://your-redis-host:6379
GATEWAY_BASE_URL=https://your-domain.com
WEBHOOK_SECRET=<random 32-byte hex>
ALIPAY_APP_ID=2021xxxxxxxx
ALIPAY_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----..."
ALIPAY_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----..."
ALIPAY_GATEWAY=https://openapi.alipaydev.com/gateway.do
```

## Deploy

```bash
pnpm install && pnpm build && pnpm start
```

## Health Check

```
GET /ping → 200 { "status": "ok" }
```

## Webhook URL

Register at Alipay: `{GATEWAY_BASE_URL}/webhook/alipay`

## Redis Persistence

```bash
redis-cli CONFIG SET appendonly yes
```

## Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | missing_gateway_id | Gateway ID not provided |
| 401 | invalid_admin_key | Admin key verification failed |
| 402 | payment_required | Payment needed (returns paymentUrl) |
| 404 | gateway_not_found | Gateway does not exist |
| 429 | rate_limit_exceeded | Too many requests |
| 500 | internal_error | Server error |
