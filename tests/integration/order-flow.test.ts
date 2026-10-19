/** Opt in with TEST_REDIS_URL pointing at a dedicated Redis instance. */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import { Readable } from 'node:stream';
import axios from 'axios';
import { createOrder, getOrder, markPaid, claimPaidOrder, deleteOrder, expirePendingOrders, isRequestLocked } from '../../src/services/order.js';
import { createGateway, deleteGateway, updateGateway } from '../../src/services/auth.js';
import { getRedis, disconnectRedis, REDIS_PREFIX, EXPIRE_ORDER_SCRIPT } from '../../src/services/redis.js';
import { registerGatewayRoutes } from '../../src/routes/gateway.js';
import { registerPaymentRoutes } from '../../src/routes/payment.js';

vi.mock('axios', () => ({ default: vi.fn() }));

describe.skipIf(!process.env.TEST_REDIS_URL)('Production order services and gateway (Redis)', () => {
  const orders: string[] = [];
  const binding = 'a'.repeat(64);
  let gatewayId: string;
  const app = Fastify();
  beforeAll(async () => {
    process.env.REDIS_URL = process.env.TEST_REDIS_URL!;
    expect(await getRedis().ping()).toBe('PONG');
    gatewayId = (await createGateway({ targetUrl: 'https://upstream.example', tierId: 'tier_100' })).gatewayId;
    await app.register(registerGatewayRoutes);
    await app.register(registerPaymentRoutes, { prefix: '/pay' });
    vi.mocked(axios).mockImplementation(async () => ({
      status: 200, headers: { 'content-type': 'text/plain' }, data: Readable.from(['ok']),
    }) as never);
  });
  afterAll(async () => {
    await app.close();
    for (const id of orders) await deleteOrder(id);
    if (gatewayId) await deleteGateway(gatewayId);
    await disconnectRedis();
  });
  async function pending() {
    const order = await createOrder(gatewayId, crypto.randomUUID(), 100, binding);
    orders.push(order.orderId);
    return order;
  }
  it('validates exact cents and makes duplicate notifications idempotent', async () => {
    const order = await pending();
    expect(await markPaid(order.orderId, 'trade-test', 1)).toBeNull();
    expect((await getOrder(order.orderId))?.status).toBe('PENDING');
    expect((await markPaid(order.orderId, 'trade-test', 100))?.status).toBe('PAID');
    expect((await markPaid(order.orderId, 'trade-test', 100))?.status).toBe('PAID');
    expect(await markPaid(order.orderId, 'other-trade', 100)).toBeNull();
  });
  it('rejects late payment without resurrecting an expired order', async () => {
    const order = await pending();
    await getRedis().hset(`${REDIS_PREFIX.order}:${order.orderId}`, 'expiresAt', String(Date.now() - 1));
    expect(await markPaid(order.orderId, 'late-trade', 100)).toBeNull();
  });
  it('atomically claims a paid order once and binds it to its gateway', async () => {
    const order = await pending();
    await markPaid(order.orderId, 'claim-trade', 100);
    expect(await claimPaidOrder(order.orderId, 'wrong-gateway', binding)).toBe(false);
    const results = await Promise.all(Array.from({ length: 20 }, () => claimPaidOrder(order.orderId, gatewayId, binding)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await getOrder(order.orderId))?.status).toBe('PROCESSING');
    await markPaid(order.orderId, 'claim-trade', 100);
    expect(await claimPaidOrder(order.orderId, gatewayId, binding)).toBe(false);
  });
  it('refuses an order whose paid redemption window has elapsed', async () => {
    const order = await pending();
    await markPaid(order.orderId, 'expiry-trade', 100);
    await getRedis().hset(`${REDIS_PREFIX.order}:${order.orderId}`, 'expiresAt', String(Date.now() - 1));
    expect(await claimPaidOrder(order.orderId, gatewayId, binding)).toBe(false);
  });
  it('forwards only one of 20 concurrent paid retries through the actual route', async () => {
    const challenge = await app.inject(`/${gatewayId}/example`);
    const order = { orderId: challenge.json().orderId as string };
    orders.push(order.orderId);
    await markPaid(order.orderId, 'route-trade', 100);
    vi.mocked(axios).mockClear();
    const results = await Promise.all(Array.from({ length: 20 }, () => app.inject({
      method: 'GET', url: `/${gatewayId}/example`, headers: { 'x-order-id': order.orderId },
    })));
    expect(results.filter((response) => response.statusCode === 200)).toHaveLength(1);
    expect(axios).toHaveBeenCalledTimes(1);
    expect(results.every((response) => [200, 402, 409].includes(response.statusCode))).toBe(true);
  });
  it('creates one order for 20 simultaneous requests with the same request ID', async () => {
    const requestId = crypto.randomUUID();
    const results = await Promise.allSettled(Array.from({ length: 20 }, () => createOrder(gatewayId, requestId, 100, binding)));
    const winners = results.filter((r) => r.status === 'fulfilled');
    expect(winners).toHaveLength(1);
    for (const r of winners) if (r.status === 'fulfilled') orders.push(r.value.orderId);
    expect(results.filter((r) => r.status === 'rejected')).toHaveLength(19);
  });

  it('does not delete a newer request lock when cleaning up an earlier paid order', async () => {
    const requestId = crypto.randomUUID();
    const first = await createOrder(gatewayId, requestId, 100, binding);
    orders.push(first.orderId);
    await markPaid(first.orderId, 'old-order-trade', 100);
    const next = await createOrder(gatewayId, requestId, 100, binding);
    orders.push(next.orderId);
    await deleteOrder(first.orderId);
    expect(await isRequestLocked(gatewayId, requestId)).toBe(true);
    await expect(createOrder(gatewayId, requestId, 100, binding)).rejects.toThrow('REQUEST_LOCKED');
  });

  it('scopes duplicate request IDs to each gateway', async () => {
    const requestId = crypto.randomUUID();
    const first = await createOrder(gatewayId, requestId, 100, binding);
    const other = await createOrder('gw_test_other', requestId, 100, binding);
    orders.push(first.orderId, other.orderId);
    expect(first.orderId).not.toBe(other.orderId);
  });

  it('does not expire a paid order during overdue-order cleanup', async () => {
    const order = await pending();
    await markPaid(order.orderId, 'cleanup-paid-trade', 100);
    await getRedis().hset(`${REDIS_PREFIX.order}:${order.orderId}`, 'expiresAt', String(Date.now() - 1));
    expect(await getRedis().eval(EXPIRE_ORDER_SCRIPT, 2, `${REDIS_PREFIX.order}:${order.orderId}`,
      `${REDIS_PREFIX.requestLock}:${gatewayId}:${order.requestId}`, String(Date.now()))).toBe(0);
    await expirePendingOrders();
    expect((await getOrder(order.orderId))?.status).toBe('PAID');
  });

  it.each(['method', 'path', 'query', 'body', 'authorization', 'accept'])('rejects a changed %s without consuming the paid order', async (changed) => {
    const original = { method: 'POST' as const, url: `/${gatewayId}/example?mode=small`,
      headers: { authorization: 'Bearer ephemeral-test-token', accept: 'application/json' },
      payload: { prompt: 'original', settings: { count: 1, format: 'plain' } } };
    const challenge = await app.inject(original);
    expect(challenge.statusCode).toBe(402);
    const orderId = challenge.json().orderId as string;
    orders.push(orderId);
    await markPaid(orderId, 'bound-route-trade', 100);
    const retry = { ...original, headers: { ...original.headers, 'x-order-id': orderId } };
    const altered = { ...retry, headers: { ...retry.headers } };
    if (changed === 'method') altered.method = 'PUT' as 'POST';
    if (changed === 'path') altered.url = `/${gatewayId}/different?mode=small`;
    if (changed === 'query') altered.url = `/${gatewayId}/example?mode=large`;
    if (changed === 'body') altered.payload = { prompt: 'different', settings: { count: 1, format: 'plain' } };
    if (changed === 'authorization') altered.headers.authorization = 'Bearer changed-test-token';
    if (changed === 'accept') altered.headers.accept = 'text/event-stream';
    vi.mocked(axios).mockClear();
    expect((await app.inject(altered)).statusCode).toBe(409);
    expect(axios).not.toHaveBeenCalled();
    expect((await getOrder(orderId))?.status).toBe('PAID');
    expect((await app.inject(retry)).statusCode).toBe(200);
    expect(axios).toHaveBeenCalledTimes(1);
  });

  it('accepts equivalent JSON key ordering and a changed request tracing ID', async () => {
    const challenge = await app.inject({ method: 'POST', url: `/${gatewayId}/example`,
      payload: { prompt: 'hello', settings: { count: 1, format: 'plain' } }, headers: { 'x-request-id': crypto.randomUUID() } });
    const orderId = challenge.json().orderId as string;
    orders.push(orderId);
    await markPaid(orderId, 'canonical-trade', 100);
    const response = await app.inject({ method: 'POST', url: `/${gatewayId}/example`,
      payload: { settings: { format: 'plain', count: 1 }, prompt: 'hello' },
      headers: { 'x-order-id': orderId, 'x-request-id': crypto.randomUUID() } });
    expect(response.statusCode).toBe(200);
  });

  it('rejects a changed configured upstream and permits retry after restoration', async () => {
    const challenge = await app.inject(`/${gatewayId}/example`);
    const orderId = challenge.json().orderId as string;
    orders.push(orderId);
    await markPaid(orderId, 'target-trade', 100);
    await updateGateway(gatewayId, { targetUrl: 'https://changed.example' });
    try {
      expect((await app.inject({ url: `/${gatewayId}/example`, headers: { 'x-order-id': orderId } })).statusCode).toBe(409);
      expect((await getOrder(orderId))?.status).toBe('PAID');
    } finally {
      await updateGateway(gatewayId, { targetUrl: 'https://upstream.example' });
    }
    expect((await app.inject({ url: `/${gatewayId}/example`, headers: { 'x-order-id': orderId } })).statusCode).toBe(200);
  });

  it('rejects legacy orders without a request fingerprint', async () => {
    const challenge = await app.inject(`/${gatewayId}/example`);
    const orderId = challenge.json().orderId as string;
    orders.push(orderId);
    await markPaid(orderId, 'legacy-trade', 100);
    await getRedis().hdel(`${REDIS_PREFIX.order}:${orderId}`, 'requestHash');
    expect(await claimPaidOrder(orderId, gatewayId, binding)).toBe(false);
    expect((await app.inject({ url: `/${gatewayId}/example`, headers: { 'x-order-id': orderId } })).statusCode).toBe(409);
  });

  it('does not create a new checkout for a legacy unbound order', async () => {
    const order = await pending();
    await getRedis().hdel(`${REDIS_PREFIX.order}:${order.orderId}`, 'requestHash');
    for (const accept of ['application/json', 'text/html']) {
      const response = await app.inject({ url: `/pay/${order.orderId}`, headers: { accept } });
      expect(response.statusCode).toBe(409);
      expect(response.json().error).toBe('legacy_order_requires_reconciliation');
    }
  });

});
