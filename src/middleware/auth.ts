import type { FastifyRequest, FastifyReply } from 'fastify';
import { validateAccess } from '../services/auth.js';
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
    const params = request.params as Record<string, string>;
    const gatewayId = params[paramName];
    if (!gatewayId) {
      return reply.status(400).send({ error: 'missing_gateway_id' });
    }

    const adminKey = request.headers['admin-secret-key'] as string | undefined;
    if (!adminKey) {
      return reply.status(401).send({ error: 'missing_admin_key' });
    }

    const { valid } = await validateAccess(gatewayId, adminKey);
    if (!valid) {
      return reply.status(401).send({ error: 'invalid_admin_key' });
    }
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

    const { valid, gateway } = await validateAccess(gatewayId);
    if (!valid) {
      return reply.status(404).send({ error: 'gateway_not_found_or_disabled' });
    }

    request.gatewayConfig = gateway;
  };
}
