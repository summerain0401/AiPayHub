import { getRedis, REDIS_PREFIX } from './redis.js';
import { generateGatewayId, generateAdminKey } from '../utils/idgen.js';
import { sha256Hash, generateSalt } from '../utils/crypto.js';
import { getTierById } from './tier.js';
import type { GatewayConfig, CreateGatewayRequest, CreateGatewayResponse } from '../types/index.js';

// ============================================
// 网关鉴权服务
// ============================================

/** 创建新网关 — 返回 gatewayId + adminKey (仅此一次!) */
export async function createGateway(
  req: CreateGatewayRequest
): Promise<CreateGatewayResponse> {
  const redis = getRedis();
  const gatewayId = generateGatewayId();
  const adminKey = generateAdminKey();
  const salt = generateSalt();
  const adminKeyHash = sha256Hash(adminKey, salt);
  const now = Date.now();

  // 从档位获取价格
  const tier = getTierById(req.tierId);
  if (!tier) {
    throw new Error(`Invalid tier: ${req.tierId}`);
  }
  const priceInCents = tier.amount;

  const config: GatewayConfig = {
    gatewayId,
    adminKeyHash: `${salt}:${adminKeyHash}`,
    targetUrl: req.targetUrl,
    tierId: req.tierId,
    price: priceInCents,
    creatorEmail: req.creatorEmail,
    alipayAccount: req.alipayAccount,
    createdAt: now,
    enabled: true,
  };

  const key = `${REDIS_PREFIX.gateway}:${gatewayId}`;
  await redis.hset(key, {
    gatewayId: config.gatewayId,
    adminKeyHash: config.adminKeyHash,
    targetUrl: config.targetUrl,
    tierId: config.tierId,
    price: String(config.price),
    creatorEmail: config.creatorEmail || '',
    alipayAccount: config.alipayAccount || '',
    createdAt: String(config.createdAt),
    enabled: '1',
  });

  return {
    gatewayId,
    adminKey,
    targetUrl: req.targetUrl,
    tierId: req.tierId,
    price: priceInCents,
  };
}

/** 验证访问 */
export async function validateAccess(
  gatewayId: string,
  adminKey?: string
): Promise<{ valid: boolean; gateway: GatewayConfig | null }> {
  const config = await getGatewayConfig(gatewayId);
  if (!config || !config.enabled) {
    return { valid: false, gateway: config };
  }

  if (!adminKey) {
    return { valid: true, gateway: config };
  }

  const [salt, storedHash] = config.adminKeyHash.split(':');
  const providedHash = sha256Hash(adminKey, salt);
  return {
    valid: providedHash === storedHash,
    gateway: config,
  };
}

/** 获取网关配置 */
export async function getGatewayConfig(gatewayId: string): Promise<GatewayConfig | null> {
  const redis = getRedis();
  const raw = await redis.hgetall(`${REDIS_PREFIX.gateway}:${gatewayId}`);
  if (!raw || Object.keys(raw).length === 0) return null;

  return {
    gatewayId: raw.gatewayId,
    adminKeyHash: raw.adminKeyHash,
    targetUrl: raw.targetUrl,
    tierId: raw.tierId || '',
    price: Number(raw.price),
    creatorEmail: raw.creatorEmail || undefined,
    alipayAccount: raw.alipayAccount || undefined,
    createdAt: Number(raw.createdAt),
    enabled: raw.enabled === '1',
  };
}

/** 更新网关配置 */
export async function updateGateway(
  gatewayId: string,
  updates: { targetUrl?: string; price?: number; enabled?: boolean }
): Promise<GatewayConfig | null> {
  const redis = getRedis();
  const key = `${REDIS_PREFIX.gateway}:${gatewayId}`;
  const exists = await redis.exists(key);
  if (!exists) return null;

  const fields: Record<string, string> = {};
  if (updates.targetUrl !== undefined) fields.targetUrl = updates.targetUrl;
  if (updates.price !== undefined) fields.price = String(Math.round(updates.price * 100));
  if (updates.enabled !== undefined) fields.enabled = updates.enabled ? '1' : '0';

  if (Object.keys(fields).length > 0) {
    await redis.hset(key, fields);
  }

  return getGatewayConfig(gatewayId);
}

/** 删除网关 */
export async function deleteGateway(gatewayId: string): Promise<boolean> {
  const redis = getRedis();
  const key = `${REDIS_PREFIX.gateway}:${gatewayId}`;
  const deleted = await redis.del(key);
  return deleted > 0;
}
