# Local payment challenge walkthrough

Start the app and an isolated local Redis as described in the README. These requests use a placeholder upstream and do not pay or contact it: the first gateway request stops at HTTP 402.

```sh
curl -sS http://localhost:3000/generate/tiers
curl -sS -X POST http://localhost:3000/generate/create \
  -H 'Content-Type: application/json' \
  -d '{"targetUrl":"https://upstream.example","tierId":"tier_100"}'
```

Store the returned `adminKey` privately. Replace `YOUR_GATEWAY_ID` below with the returned gateway ID:

```sh
curl -i http://localhost:3000/YOUR_GATEWAY_ID/example
```

Expected: HTTP 402, an `orderId`, a local `paymentUrl`, and `amount: 100` (¥1.00). `/pay/{orderId}/status` reports `pending` until a valid provider success notification is processed. Use `paymentUrl` for browser checkout; the challenge does not fabricate a provider deep link.

Do not send mock success callbacks to a deployed instance. For offline payment-state and replay checks, run the Redis test suite. To test real checkout later, configure your own Alipay sandbox and validate the full callback path with the provider; this review did not complete sandbox settlement.
