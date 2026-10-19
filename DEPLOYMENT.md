# Local deployment and sandbox evaluation

This is a prototype. Read [PUBLIC_READINESS.md](docs/PUBLIC_READINESS.md) before exposing it to other users.

## Configuration

Use Node.js 22, pnpm 10 and Redis 7 or later. Copy `.env.example` to `.env`. Leave payment credentials blank for initial 402-only evaluation. Set `GATEWAY_BASE_URL` to the app origin; it is used to construct links and the callback URL.

For Alipay sandbox evaluation, configure `ALIPAY_APP_ID`, `ALIPAY_PRIVATE_KEY`, `ALIPAY_PUBLIC_KEY` and the sandbox `ALIPAY_GATEWAY`. Keep keys in your local environment or secret manager. `WEBHOOK_SECRET` is not used for Alipay notification verification; that path uses the SDK's RSA verification. Price tier service IDs are configuration scaffolding and are not a verified A2A integration.

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm build
pnpm start
```

Health endpoint: `GET /ping`. Callback endpoint: `POST /webhook/alipay`. It accepts form-encoded notifications as well as JSON, verifies the signature and application ID, and acknowledges after queue insertion. Only successful trades can be applied, and the integer-cent amount must match the pending order. The SDK creates a WAP checkout URL locally; a successful real or sandbox settlement was not tested in this review.

## Containers

```sh
cp .env.example .env
docker compose up --build
```

Compose overrides `REDIS_URL` to `redis://redis:6379`. Redis is bound to host loopback; the app port is 3000. `.dockerignore` excludes local secrets from the build context. The Redis volume uses AOF persistence. Container execution is separate from the local build/test checks; it has not been validated on a Docker daemon in this review.

## Before internet deployment

Gateway creation is open and accepts user-supplied upstream URLs. Enforce registration access and an upstream allowlist with network egress restrictions outside the app until SSRF controls are implemented, including DNS rebinding and redirect checks. Restrict the app and Redis to a trusted evaluation environment. The included rate-limit middleware is not attached to all routes. Dashboard credentials currently travel in query parameters and may appear in access logs; do not use real reusable credentials. Add header-only authentication before shared deployment.

Redis must be dedicated and appropriately protected. Order deletion removes billing history; keep a separate durable ledger before taking real payments. The webhook queue has a crash window between popping an item and recording it as processing, and retry recovery is not a transactional delivery guarantee. Add atomic queue transfer, reconciliation, refund policy, request binding and failure recovery before production use.
