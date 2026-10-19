# Public readiness review — 2026-10-19

Baseline: `d1877a6`. GitHub reported this repository **already public** at review time. No visibility setting was changed. The proposed branch is for owner review and does not patch any deployed service.

## Sensitive history

A project-format admin credential was committed in `.claude/settings.json`, alongside local request history. Its value is intentionally not reproduced. This branch removes that file and ignores future local settings and environment files. If the credential or related gateway still exists, revoke/recreate it and check for reuse. The branch does not remove the original commit; old objects and clones may retain it. Coordinate any history rewrite separately after rotation and owner approval.

Gitleaks 8.30.1 default rules scanned all fetched reachable history (one baseline commit) without a hit. Supplemental project-specific scanning and manual review found the credential above. Default scanner results therefore do not certify a safe release. The new `.gitleaks.toml` extends the standard rules with this project’s admin-key format; a history scan with it will correctly continue to flag the old commit until history disposition is resolved. The deployment key fragment and test-only HMAC strings were reviewed as placeholders, not production credentials. Unreachable objects, forks, private CI secrets and external deployments were not inspected.

## Fixes proposed

- Remove the unauthenticated test callback that could grant a paid order.
- Verify the callback app ID, parse decimal yuan into integer cents, ignore non-success notifications, and check amount and expiry atomically in Redis.
- Await notification queue insertion before acknowledging it; duplicate notifications for the same paid trade do not grant another use.
- Atomically claim a paid order for its gateway before dispatch, including under concurrent retries.
- Build WAP checkout URLs with the SDK's page API; add form notification parsing.
- Exercise production services and actual HTTP routes, with Redis integration checks explicitly opt-in locally and enabled by the optional CI template.

## Validation

Local TypeScript check and build pass. All 38 tests pass with a dedicated local Redis, including actual SDK RSA2 verification and concurrent production-route redemption. The npm official audit endpoint reports zero known advisories for the final lockfile on 2026-10-19 (baseline had 86). Removed three unused runtime packages, updated affected dependencies, and set a security floor of urllib 4.9.1 within the Alipay SDK’s supported 4.x range. The selected runtime is Node.js 22.12 or later and pnpm 10.33.0. This result does not establish provider settlement or production readiness.

The current GitHub OAuth credential cannot create workflow files (missing workflow scope). The checks are supplied as `docs/ci-template.yml`, not installed or remotely executed. All validation results above are local.

## Remaining release/deployment gates

- Owner decision on license and third-party skill redistribution; see [RIGHTS.md](RIGHTS.md).
- Confirm exposed credential revocation and history disposition. No provider credentials were used to test this review.
- Restrict prototype deployment: open gateway registration and upstream URL SSRF, query-string dashboard credentials, unenforced rate limits, request/body binding, queue crash recovery, durable accounting and refund handling still require work. See [DEPLOYMENT.md](../DEPLOYMENT.md).
- The fabricated `alipay://` challenge hint was removed. Existing product pages predate this review and are not proof of x402/A2A conformance. The README defines the verified implementation boundary. No FLOP integration exists in the audited code.
- Provider sandbox settlement, Dify/Coze live integrations and container runtime require separate verification before claiming them.

Public source availability, an open-source license, and a safe live payment service are separate decisions. This PR is preparation, not release approval.
