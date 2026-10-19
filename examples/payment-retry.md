# Payment retries

A payment authorizes the operation that created the order. Retry the same HTTP method, path/query, forwarded application headers and body, adding `X-Order-Id` from the initial 402 response. The configured upstream address must also remain unchanged. Keep Authorization, Accept and Content-Type unchanged; only payment/tracing/transport headers are excluded from the binding.

Only a SHA-256 digest of the operation is stored with the order, not a copy of the body or credentials. This is an integrity check, not encrypted storage or an account-bound customer authentication system. Treat the order ID as a private bearer value.

Equivalent JSON object key ordering is accepted, recursively. Array order, text content, query parameter order and forwarded header values remain significant. Changing the request returns HTTP 409 `order_request_mismatch`; it does not consume the order. Retry the original request while its redemption window remains valid.

Requests sharing one X-Request-Id on one gateway are atomically deduplicated while the pending lock exists. The same tracing ID can be used on a different gateway. After a payment releases that pending lock, a later order may use it; deleting the earlier order must not clear the later order's lock.

## Existing prototype orders

Orders created before this binding field was introduced cannot be redeemed by this version. Reconcile outstanding paid orders before deploying an upgrade. There is no automatic refund, legacy order conversion or guaranteed delivery recovery in this prototype. No deployed service or real payment was migrated in this review.

## Local verification

The Redis suite checks six changed request dimensions (method, path, query, body, Authorization and Accept), upstream retargeting, equivalent JSON ordering, a changed tracing ID, legacy-order rejection, concurrent creation and preservation of a newer lock during old-order cleanup. Initial challenges and retries go through the actual Fastify gateway route; upstream responses are mocked locally.
