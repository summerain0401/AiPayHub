# AI-Pay Hub

[中文](README.md) | [English](README.en.md)

An experimental per-use payment gateway built with TypeScript, Fastify, and Redis. Explores HTTP 402, payment orders, one-use retries, and streaming AI-service proxying. Includes gateway generation, administration, Dify OpenAPI import, and an Alipay adapter.

**Status: experimental.** [Payment and administrator improvements in PR #1](https://github.com/summerain0401/AiPayHub/pull/1) are not merged into the default branch. Its fixes, test results, and license files must not be described as existing default-branch behavior. Returning HTTP 402 does not establish general x402-protocol or on-chain-settlement compatibility.

## Local development

Requires Node.js 20+, pnpm, and a reachable Redis 7 instance:

```bash
pnpm install --frozen-lockfile
cp .env.example .env
# Edit .env for your local environment and start Redis first
pnpm dev
```

Open <http://localhost:3000/generator>. Administration is at `/dash`; `/ping` is the health endpoint. Review `scripts/dev-setup.sh` before using it: it installs dependencies, creates configuration, and may start Docker Redis.

## Request flow and configuration

Client request → pending order → HTTP 402 and payment URL → payment callback updates status → client retries with `X-Order-Id` → upstream proxy and order consumption.

See [environment placeholders](.env.example) and [deployment instructions](DEPLOYMENT.md). Configure Redis, the public gateway URL, webhook secret, and Alipay application/signing/verification values. The default payment gateway is the sandbox; real payments require Alipay configuration.

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/ping` | Health |
| POST | `/generate/create` | Create gateway |
| Proxy request | `/{gatewayId}/*` | Payment-gated forwarding |
| GET | `/poll/{orderId}` | Order polling |
| GET | `/pay/{orderId}` | Payment entry |
| POST | `/webhook/alipay` | Payment callback |
| GET | `/dash/stats` | Administrator statistics |
| GET | `/schema/{gatewayId}/openapi.json` | Dify import |

## Validation and limits

```bash
pnpm lint
pnpm build
pnpm test
```

See `tests/` for test dependencies and cases. No real payment or deployment was performed for this documentation update. The default branch contains experimental administration and callback endpoints; production readiness requires reviewing the implementation and the open PR.

## License

The existing README / package metadata states MIT, but the default branch has no standalone LICENSE file. The license files in PR #1 remain unmerged; this update neither merges the PR nor changes licensing.
