import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { Writable } from 'node:stream';
import { createGateway, deleteGateway, validateAccess, rotateAdminKey } from '../../src/services/auth.js';
import { getRedis, disconnectRedis } from '../../src/services/redis.js';
import { registerAdminRoutes } from '../../src/routes/admin.js';
import { registerGeneratorRoutes } from '../../src/routes/generator.js';
import { loggerOptions } from '../../src/utils/logging.js';

describe.skipIf(!process.env.TEST_REDIS_URL)('Production administrator routes (Redis)', () => {
  let gatewayId: string;
  let adminKey: string;
  const gateways: string[] = [];
  let logs = '';
  const stream = new Writable({ write(chunk, _encoding, done) { logs += chunk.toString(); done(); } });
  const app = Fastify({ logger: { ...loggerOptions, stream } });
  beforeAll(async () => {
    process.env.REDIS_URL = process.env.TEST_REDIS_URL!;
    await getRedis().ping();
    const gateway = await createGateway({ targetUrl: 'https://upstream.example', tierId: 'tier_100' });
    ({ gatewayId, adminKey } = gateway);
    gateways.push(gatewayId);
    await app.register(registerAdminRoutes, { prefix: '/dash' });
    await app.register(registerGeneratorRoutes, { prefix: '/generate' });
  });
  afterAll(async () => {
    await app.close();
    for (const id of gateways) {
      await deleteGateway(id);
      await getRedis().del(`ai-pay:admin-attempts:127.0.0.1:${id}`);
    }
    await disconnectRedis();
  });
  function post(url: string, payload: Record<string, unknown>, key = adminKey) {
    return app.inject({ method: 'POST', url, headers: { 'admin-secret-key': key }, payload });
  }

  it('requires a header credential and rejects legacy query credentials', async () => {
    expect((await app.inject(`/dash/gateway?gatewayId=${gatewayId}`)).statusCode).toBe(401);
    const rejected = await app.inject(`/dash/gateway?gatewayId=${gatewayId}&adminKey=${adminKey}`);
    expect(rejected.statusCode).toBe(400);
    const accepted = await app.inject({ url: `/dash/gateway?gatewayId=${gatewayId}`, headers: { 'admin-secret-key': adminKey } });
    expect(accepted.statusCode).toBe(200);
    expect(accepted.headers['cache-control']).toBe('no-store');
    expect(accepted.json()).not.toHaveProperty('adminKeyHash');
  });

  it('does not log query-string or header credentials even for rejected requests', async () => {
    logs = '';
    await app.inject({ url: `/dash/gateway?gatewayId=${gatewayId}&adminKey=${adminKey}`, headers: { 'admin-secret-key': adminKey } });
    expect(logs).not.toContain(adminKey);
    expect(logs).toContain('/dash/gateway');
  });

  it('can disable and re-enable a gateway with the same administrator credential', async () => {
    expect((await post('/generate/update', { gatewayId, enabled: false })).json().enabled).toBe(false);
    expect((await post('/generate/validate', { gatewayId })).statusCode).toBe(200);
    expect((await post('/generate/update', { gatewayId, enabled: true })).json().enabled).toBe(true);
  });

  it('rejects conflicting gateway IDs before updating a body-selected gateway', async () => {
    const other = await createGateway({ targetUrl: 'https://other.example', tierId: 'tier_100' });
    gateways.push(other.gatewayId);
    expect((await post(`/generate/update?gatewayId=${gatewayId}`, { gatewayId: other.gatewayId, enabled: false })).statusCode).toBe(400);
    expect((await validateAccess(other.gatewayId, other.adminKey)).gateway?.enabled).toBe(true);
  });

  it('returns a new key once and immediately rejects the old key', async () => {
    const oldKey = adminKey;
    const response = await post('/generate/rotate-key', { gatewayId });
    expect(response.statusCode).toBe(200);
    adminKey = response.json().adminKey;
    expect(adminKey).not.toBe(oldKey);
    expect((await post('/generate/validate', { gatewayId }, oldKey)).statusCode).toBe(401);
    expect((await post('/generate/validate', { gatewayId })).statusCode).toBe(200);
  });

  it('allows only one concurrent rotation using the same old key', async () => {
    const keys = await Promise.all(Array.from({ length: 10 }, () => rotateAdminKey(gatewayId, adminKey)));
    const winners = keys.filter((key): key is string => key !== null);
    expect(winners).toHaveLength(1);
    adminKey = winners[0];
    expect((await validateAccess(gatewayId, adminKey)).valid).toBe(true);
  });

  it('throttles repeated invalid credentials across administrator routes', async () => {
    for (let i = 0; i < 5; i++) {
      expect((await post('/generate/validate', { gatewayId }, 'invalid-test-key')).statusCode).toBe(401);
    }
    const response = await app.inject({ url: `/dash/gateway?gatewayId=${gatewayId}`, headers: { 'admin-secret-key': 'invalid-test-key' } });
    expect(response.statusCode).toBe(429);
  });
});
