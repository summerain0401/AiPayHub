import type { FastifyPluginAsync } from 'fastify';
import { createGateway, validateAccess, updateGateway, deleteGateway } from '../services/auth.js';
import { requireAdmin } from '../middleware/auth.js';
import { getTiers } from '../services/tier.js';
import { getRedis } from '../services/redis.js';
import type { CreateGatewayRequest } from '../types/index.js';

const MAX_AMOUNT_CENTS = 2000; // 最高 ¥20.00

export const registerGeneratorRoutes: FastifyPluginAsync = async (app) => {
  /** GET /tiers — 可用价格档位 */
  app.get('/tiers', async (_request, reply) => {
    const tiers = getTiers().map((t) => ({
      id: t.id,
      amount: t.amount,
      label: t.label,
      labelCNY: t.labelCNY,
    }));
    return reply.send({ tiers });
  });

  /** POST /create */
  app.post('/create', async (request, reply) => {
    const body = request.body as CreateGatewayRequest;
    if (!body.targetUrl) return reply.status(400).send({ error: 'missing targetUrl' });
    if (!body.tierId) return reply.status(400).send({ error: 'missing tierId' });
    try { new URL(body.targetUrl); } catch {
      return reply.status(400).send({ error: 'invalid targetUrl' });
    }
    try {
      const result = await createGateway(body);
      return reply.status(201).send(result);
    } catch (err) {
      return reply.status(400).send({ error: (err as Error).message });
    }
  });

  /** POST /validate */
  app.post('/validate', async (request, reply) => {
    const body = request.body as { gatewayId: string; adminKey: string };
    if (!body.gatewayId || !body.adminKey) {
      return reply.status(400).send({ error: 'missing gatewayId or adminKey' });
    }

    // Brute-force protection: max 5 attempts per IP per gateway per 10 minutes
    const ip = request.ip || 'unknown';
    const attemptKey = `ai-pay:auth-attempts:${body.gatewayId}:${ip}`;
    const redis = getRedis();
    const attempts = await redis.incr(attemptKey);
    if (attempts === 1) await redis.expire(attemptKey, 600);
    if (attempts > 5) {
      return reply.status(429).send({ error: 'too_many_attempts', retryAfter: 600 });
    }

    const { valid, gateway } = await validateAccess(body.gatewayId, body.adminKey);
    if (valid) await redis.del(attemptKey); // reset on success
    return reply.send({
      valid,
      gateway: gateway ? {
        gatewayId: gateway.gatewayId, targetUrl: gateway.targetUrl,
        tierId: gateway.tierId, price: gateway.price,
        enabled: gateway.enabled, createdAt: gateway.createdAt,
      } : null,
    });
  });

  /** POST /update */
  app.post('/update', { preHandler: requireAdmin() }, async (request, reply) => {
    const body = request.body as { gatewayId: string; targetUrl?: string; enabled?: boolean };
    const result = await updateGateway(body.gatewayId, { targetUrl: body.targetUrl, enabled: body.enabled });
    if (!result) return reply.status(404).send({ error: 'gateway_not_found' });
    return reply.send({ gatewayId: result.gatewayId, targetUrl: result.targetUrl, tierId: result.tierId, price: result.price, enabled: result.enabled, createdAt: result.createdAt });
  });

  /** POST /delete */
  app.post('/delete', { preHandler: requireAdmin() }, async (request, reply) => {
    const body = request.body as { gatewayId: string };
    const deleted = await deleteGateway(body.gatewayId);
    if (!deleted) return reply.status(404).send({ error: 'gateway_not_found' });
    return reply.send({ success: true });
  });
};
