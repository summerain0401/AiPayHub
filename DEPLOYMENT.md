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

Gateway creation is open and accepts user-supplied upstream URLs. Enforce registration access and an upstream allowlist with network egress restrictions outside the app until SSRF controls are implemented, including DNS rebinding and redirect checks. Restrict the app and Redis to a trusted evaluation environment. The included rate-limit middleware is not attached to all routes. Dashboard credentials now use the `Admin-Secret-Key` header. Query/body credentials are rejected; the dashboard has been migrated. Request logs omit query values, headers and bodies, and authenticated responses are not cached. Administrator endpoints share a five-failure limit per IP and gateway in ten minutes; successful authentication clears that counter. Disabled gateways can be managed and re-enabled. See [admin access and rotation](examples/admin-access.md).

Redis must be dedicated and appropriately protected. Order deletion removes billing history; keep a separate durable ledger before taking real payments. The webhook queue has a crash window between popping an item and recording it as processing, and retry recovery is not a transactional delivery guarantee. Add atomic queue transfer, reconciliation, refund policy, failure recovery before production use.

## Request binding and prototype order migration

New orders bind the HTTP method, configured upstream destination, effective path/query, forwarded request headers and parsed body. Only a digest is stored. JSON object keys are sorted recursively; array order and text bodies remain significant. Payment and tracing IDs and transport headers are excluded because they are not forwarded. A mismatch returns 409 without consuming the paid order. All forwarded application headers, including Authorization and Accept, must match the initial request.

Legacy prototype orders without a binding cannot be redeemed by this version. Do not upgrade a service with outstanding paid orders without first reconciling them; this prototype has no automatic refund or legacy-order conversion. The owner confirmed the historical local test was stopped. No production migration was performed. See [payment retries](examples/payment-retry.md).
