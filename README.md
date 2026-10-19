# AI-Pay Hub

A TypeScript research prototype for putting a per-request payment gate in front of an HTTP API. Built with Fastify, Redis and the Alipay SDK.

中文：面向 AI 服务的按次付费网关原型，用于探索 HTTP 402、付款通知与一次性调用之间的接口设计。

**Status: experimental.** The implementation uses a project-specific HTTP 402 response and an Alipay WAP checkout adapter. It does not implement Coinbase x402 payment headers, an on-chain facilitator, stablecoin settlement, or a verified Alipay Agent-to-Agent integration. Dify and Coze are HTTP upstream use cases; their live integrations have not been verified by this review. No FLOP affiliation or integration is claimed.

## Run locally

Requires Node.js 22, pnpm 10 and a dedicated Redis instance. No payment credentials are needed to create a gateway and inspect the initial 402 response. Payment completion requires an Alipay sandbox account and keys.

```sh
pnpm install --frozen-lockfile --ignore-scripts
cp .env.example .env
# Start Redis locally; set REDIS_URL if it is not localhost:6379.
pnpm dev
# Open http://localhost:3000/generator
```

For a read-only initial payment challenge, see [the local walkthrough](examples/local-walkthrough.md). Configuration and container instructions are in [DEPLOYMENT.md](DEPLOYMENT.md).

## Request lifecycle

1. `POST /generate/create` stores an upstream URL and fixed price tier; returns a public gateway ID and a one-time admin key.
2. A request to `/{gatewayId}/*` without `X-Order-Id` creates a five-minute pending order and returns 402 with `orderId`, `paymentUrl` and amount in integer CNY cents.
3. `/pay/{orderId}` builds a signed Alipay WAP checkout URL. A verified success notification is queued, then the order is marked paid only if the app, amount and validity checks pass.
4. The client retries the same method, destination, forwarded headers and body with `X-Order-Id`. JSON object key ordering is normalized. The order stores a digest of that operation; a changed request returns 409 without consuming it. Redis atomically checks that binding and claims a paid order for that gateway before upstream dispatch. Only one concurrent retry wins. The response can stream; the order is removed when the stream ends or fails.

Claiming grants one dispatch attempt, not guaranteed successful delivery. An upstream failure can consume a payment; refunds and durable delivery receipts are not implemented. Dashboard statistics cover retained orders, not an accounting ledger.

## API overview

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/ping` | Process health |
| GET | `/generate/tiers` | Available prices, in cents |
| POST | `/generate/create` | Create a gateway |
| GET/POST/PUT/PATCH/DELETE | `/{gatewayId}/*` | Payment-gated upstream request |
| GET | `/pay/{orderId}` | HTML checkout page, or JSON when HTML is not requested |
| GET | `/pay/{orderId}/status` or `/poll/{orderId}` | Order status |
| POST | `/webhook/alipay` | Signed JSON or form notification |
| GET | `/dash/stats`, `/dash/orders`, `/dash/gateway` | Dashboard; gateway ID query and `Admin-Secret-Key` header |
| POST | `/generate/rotate-key` | Replace the gateway admin key; returns it once and invalidates the old key |
| GET | `/schema/{gatewayId}/openapi.json` | Generated schema |

`/webhook/test` is intentionally absent. Examples must not create a public payment bypass.

## Checks

```sh
pnpm lint
pnpm build
pnpm test
# Production Redis service tests are explicitly skipped without TEST_REDIS_URL.
# Point only at an isolated test Redis; The optional CI template supplies one.
TEST_REDIS_URL=redis://127.0.0.1:16389/0 pnpm test
```

The Redis suite imports production order services and exercises the actual gateway route with an in-memory upstream response. It checks amount mismatches, late notifications, idempotency, gateway binding and concurrent redemption. Request binding, concurrent order creation and cleanup are also checked through production services. It does not perform a real Alipay transaction. [docs/ci-template.yml](docs/ci-template.yml) can be installed as `.github/workflows/ci.yml` by an account with workflow write permission; it was not enabled by this PR. See [security and release status](docs/PUBLIC_READINESS.md) for limitations and remaining release gates.

## License and contributions

The owner selected the [MIT License](LICENSE) for original project software and documentation. See [LICENSE-SCOPE.md](LICENSE-SCOPE.md) for third-party exclusions and [RIGHTS.md](docs/RIGHTS.md) for provenance notes.

Administrator calls use `Admin-Secret-Key` exclusively; putting it in the URL or JSON body is rejected. Disabled gateways remain administrable so they can be re-enabled. Rotation and migration examples are in [examples/admin-access.md](examples/admin-access.md).

For code discussion, use this repository's issues or pull requests. Never attach payment keys or admin credentials.

Request retry and order-format migration details: [examples/payment-retry.md](examples/payment-retry.md).
