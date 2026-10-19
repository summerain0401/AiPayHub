import type { FastifyPluginAsync } from 'fastify';
import { createGateway, updateGateway, deleteGateway, rotateAdminKey } from '../services/auth.js';
import { requireAdmin } from '../middleware/auth.js';
import { getTiers } from '../services/tier.js';
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
  app.post('/validate', { preHandler: requireAdmin() }, async (request, reply) => {
    const gateway = request.gatewayConfig;
    return reply.send({
      valid: true,
      gateway: gateway ? {
        gatewayId: gateway.gatewayId, targetUrl: gateway.targetUrl,
        tierId: gateway.tierId, price: gateway.price,
        enabled: gateway.enabled, createdAt: gateway.createdAt,
      } : null,
    });
  });

  app.post('/rotate-key', { preHandler: requireAdmin() }, async (request, reply) => {
    const gatewayId = request.gatewayConfig!.gatewayId;
    const nextKey = await rotateAdminKey(gatewayId, request.headers['admin-secret-key'] as string);
    if (!nextKey) return reply.status(409).send({ error: 'credential_changed_retry_login' });
    return reply.send({ gatewayId, adminKey: nextKey });
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
