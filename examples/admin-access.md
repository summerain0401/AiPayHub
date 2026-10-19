# Administrator access and key replacement

These operations change the target instance. Test them against a dedicated local gateway first. The old development key was confirmed by the owner to belong to a stopped local test and was not reused; it was not used to make any request during this review.

## Header-only authentication

All administrator operations use the `Admin-Secret-Key` request header. The gateway ID stays in the query for dashboard reads and in the JSON body for generator actions. Passing `adminKey` in a URL or JSON body is rejected, even if a valid header is also present. Update old integrations before deployment.

```http
GET /dash/gateway?gatewayId=YOUR_GATEWAY_ID
Admin-Secret-Key: YOUR_PRIVATE_ADMIN_KEY
```

```http
POST /generate/validate
Content-Type: application/json
Admin-Secret-Key: YOUR_PRIVATE_ADMIN_KEY

{"gatewayId":"YOUR_GATEWAY_ID"}
```

These are placeholders. Store credentials privately and do not copy real keys into public issues, screenshots, shell history or checked-in request files. Authenticated responses have `Cache-Control: no-store`. The default request logger omits query values, headers and bodies; infrastructure outside this app needs its own logging configuration.

## Replace a key

```http
POST /generate/rotate-key
Content-Type: application/json
Admin-Secret-Key: YOUR_CURRENT_PRIVATE_KEY

{"gatewayId":"YOUR_GATEWAY_ID"}
```

A successful response returns `{gatewayId, adminKey}`. Save that new key immediately: the old key stops authenticating as soon as replacement succeeds. Only the salted hash is stored. Concurrent replacements using the same old key have one winner; losers return 401 or 409. Lost responses and lost keys require a separate operator recovery procedure; no unauthenticated key recovery endpoint exists.

Gateway disablement blocks public use but does not block its administrator. The same valid key can re-enable the gateway. Conflicting gateway IDs in body/query/route are rejected, so authorization cannot apply to one gateway while modifying another.

After five failed authentications per IP and gateway within ten minutes, further administrator calls return 429 until the window expires. A successful login before that threshold clears the failure count. Missing credentials and malformed IDs are rejected before Redis authentication attempts.

## Verification

Run `TEST_REDIS_URL=redis://127.0.0.1:16389/0 pnpm test` against an isolated Redis. Tests create temporary gateways, exercise header-only reads, verify that rejected legacy URLs do not log keys, disable/re-enable a gateway, rotate a key, prove old-key rejection and race ten rotations. No deployed gateway or historical credential is used.
