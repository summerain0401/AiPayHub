import type { FastifyRequest, FastifyReply } from 'fastify';
import { validateAccess, getGatewayConfig } from '../services/auth.js';
import { getRedis } from '../services/redis.js';
import type { GatewayConfig } from '../types/index.js';

// ============================================
// 鉴权中间件
// ============================================

/** 声明增强: 网关配置挂载到 request */
declare module 'fastify' {
  interface FastifyRequest {
    gatewayConfig?: GatewayConfig | null;
  }
}

/** 管理员鉴权 — 需要 Admin-Secret-Key header */
export function requireAdmin(paramName = 'gatewayId') {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, unknown>;
    const query = request.query as Record<string, unknown>;
    const body = request.body as Record<string, unknown> | undefined;
    if (Object.hasOwn(query, 'adminKey') || (body && Object.hasOwn(body, 'adminKey'))) {
      return reply.status(400).send({ error: 'use_admin_secret_key_header' });
    }
    const candidates = [params?.[paramName], query?.[paramName], body?.[paramName]].filter((value) => value !== undefined);
    const gatewayId = candidates[0];
    if (typeof gatewayId !== 'string' || !/^gw_[A-Za-z0-9_-]{24}$/.test(gatewayId)) {
      return reply.status(400).send({ error: 'missing_gateway_id' });
    }
    if (candidates.some((value) => value !== gatewayId)) {
      return reply.status(400).send({ error: 'conflicting_gateway_id' });
    }

    const adminKey = request.headers['admin-secret-key'] as string | undefined;
    if (typeof adminKey !== 'string' || !adminKey) {
      return reply.status(401).send({ error: 'missing_admin_key' });
    }

    const attemptKey = `ai-pay:admin-attempts:${request.ip}:${gatewayId}`;
    const attempts = await getRedis().eval(`
      local n = redis.call('INCR', KEYS[1])
      if n == 1 then redis.call('EXPIRE', KEYS[1], 600) end
      return n
    `, 1, attemptKey);
    if (attempts > 5) return reply.status(429).header('Retry-After', '600').send({ error: 'too_many_attempts' });

    const { valid, gateway } = await validateAccess(gatewayId, adminKey);
    if (!valid) {
      return reply.status(401).send({ error: 'invalid_admin_key' });
    }
    await getRedis().del(attemptKey);
    request.gatewayConfig = gateway;
    reply.header('Cache-Control', 'no-store');
  };
}

/** 网关公共鉴权 — 仅检查网关存在且启用 */
export function requireGateway(paramName = 'gatewayId') {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as Record<string, string>;
    const gatewayId = params[paramName];
    if (!gatewayId) {
      return reply.status(400).send({ error: 'missing_gateway_id' });
    }

    const gateway = await getGatewayConfig(gatewayId);
    if (!gateway || !gateway.enabled) {
      return reply.status(404).send({ error: 'gateway_not_found_or_disabled' });
    }

    request.gatewayConfig = gateway;
  };
}
