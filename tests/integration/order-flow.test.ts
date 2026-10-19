/** Opt in with TEST_REDIS_URL pointing at a dedicated Redis instance. */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import { Readable } from 'node:stream';
import axios from 'axios';
import { createOrder, getOrder, markPaid, claimPaidOrder, deleteOrder } from '../../src/services/order.js';
import { createGateway, deleteGateway } from '../../src/services/auth.js';
import { getRedis, disconnectRedis, REDIS_PREFIX } from '../../src/services/redis.js';
import { registerGatewayRoutes } from '../../src/routes/gateway.js';

vi.mock('axios', () => ({ default: vi.fn() }));

describe.skipIf(!process.env.TEST_REDIS_URL)('Production order services and gateway (Redis)', () => {
  const orders: string[] = [];
  let gatewayId: string;
  const app = Fastify();
  beforeAll(async () => {
    process.env.REDIS_URL = process.env.TEST_REDIS_URL!;
    expect(await getRedis().ping()).toBe('PONG');
    gatewayId = (await createGateway({ targetUrl: 'https://upstream.example', tierId: 'tier_100' })).gatewayId;
    await app.register(registerGatewayRoutes);
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
    const order = await createOrder(gatewayId, crypto.randomUUID(), 100);
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
    expect(await claimPaidOrder(order.orderId, 'wrong-gateway')).toBe(false);
    const results = await Promise.all(Array.from({ length: 20 }, () => claimPaidOrder(order.orderId, gatewayId)));
    expect(results.filter(Boolean)).toHaveLength(1);
    expect((await getOrder(order.orderId))?.status).toBe('PROCESSING');
    await markPaid(order.orderId, 'claim-trade', 100);
    expect(await claimPaidOrder(order.orderId, gatewayId)).toBe(false);
  });
  it('refuses an order whose paid redemption window has elapsed', async () => {
    const order = await pending();
    await markPaid(order.orderId, 'expiry-trade', 100);
    await getRedis().hset(`${REDIS_PREFIX.order}:${order.orderId}`, 'expiresAt', String(Date.now() - 1));
    expect(await claimPaidOrder(order.orderId, gatewayId)).toBe(false);
  });
  it('forwards only one of 20 concurrent paid retries through the actual route', async () => {
    const order = await pending();
    await markPaid(order.orderId, 'route-trade', 100);
    vi.mocked(axios).mockClear();
    const results = await Promise.all(Array.from({ length: 20 }, () => app.inject({
      method: 'GET', url: `/${gatewayId}/example`, headers: { 'x-order-id': order.orderId },
    })));
    expect(results.filter((response) => response.statusCode === 200)).toHaveLength(1);
    expect(axios).toHaveBeenCalledTimes(1);
    expect(results.every((response) => [200, 402, 409].includes(response.statusCode))).toBe(true);
  });
});
