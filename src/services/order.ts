import { getRedis, REDIS_PREFIX, MARK_PAID_SCRIPT, CLAIM_PAID_SCRIPT, CREATE_ORDER_SCRIPT, DELETE_ORDER_SCRIPT, EXPIRE_ORDER_SCRIPT } from './redis.js';
import { generateOrderId } from '../utils/idgen.js';
import type { OrderRecord, OrderStatus } from '../types/index.js';

const ORDER_TTL_SECONDS = 300; // 5 分钟

let markPaidSha: string | null = null;

async function getMarkPaidSha(): Promise<string> {
  if (!markPaidSha) {
    markPaidSha = await getRedis().script('LOAD', MARK_PAID_SCRIPT) as string;
  }
  return markPaidSha;
}

// ============================================
// 订单 CRUD
// ============================================

export async function createOrder(
  gatewayId: string,
  requestId: string,
  amount: number,
  requestHash: string,
  method: 'alipay' | 'wechat' = 'alipay'
): Promise<OrderRecord> {
  if (!/^[a-f0-9]{64}$/.test(requestHash)) throw new Error('REQUEST_BINDING_REQUIRED');
  const redis = getRedis();
  const orderId = generateOrderId();
  const now = Date.now();

  const lockKey = requestLockKey(gatewayId, requestId);

  const order: OrderRecord = {
    orderId,
    gatewayId,
    requestId,
    requestHash,
    status: 'PENDING',
    amount,
    paymentMethod: method,
    createdAt: now,
    expiresAt: now + ORDER_TTL_SECONDS * 1000,
  };

  const orderKey = `${REDIS_PREFIX.order}:${orderId}`;
  const result = await redis.eval(CREATE_ORDER_SCRIPT, 3,
    orderKey, lockKey, `${REDIS_PREFIX.gatewayOrders}:${gatewayId}`, JSON.stringify({
      orderId, gatewayId, requestId, requestHash,
      status: 'PENDING', amount: String(amount), paymentMethod: method,
      createdAt: String(now), expiresAt: String(order.expiresAt),
    }));
  if (result !== 1) throw new Error('REQUEST_LOCKED: duplicate request');

  return order;
}

export async function markPaid(
  orderId: string,
  tradeNo: string,
  amount: number
): Promise<OrderRecord | null> {
  if (!tradeNo || !Number.isSafeInteger(amount) || amount <= 0) return null;
  const redis = getRedis();
  const orderKey = `${REDIS_PREFIX.order}:${orderId}`;
  const [requestId, gatewayId] = await redis.hmget(orderKey, 'requestId', 'gatewayId');
  const lockKey = requestLockKey(gatewayId || '', requestId || '');
  const paidAt = String(Date.now());
  const sha = await getMarkPaidSha();

  const result = await redis.evalsha(
    sha, 2, orderKey, lockKey, tradeNo, paidAt, String(amount)
  ) as number;

  if (result === 0) return null;
  return getOrder(orderId);
}

export async function claimPaidOrder(orderId: string, gatewayId: string, requestHash: string): Promise<boolean> {
  return (await getRedis().eval(
    CLAIM_PAID_SCRIPT, 1, `${REDIS_PREFIX.order}:${orderId}`, gatewayId, String(Date.now()), requestHash
  )) === 1;
}

export async function getOrder(orderId: string): Promise<OrderRecord | null> {
  const raw = await getRedis().hgetall(`${REDIS_PREFIX.order}:${orderId}`);
  if (!raw || Object.keys(raw).length === 0) return null;
  return deserialize(raw);
}

export async function deleteOrder(orderId: string): Promise<void> {
  const redis = getRedis();
  const orderKey = `${REDIS_PREFIX.order}:${orderId}`;
  const raw = await redis.hgetall(orderKey);
  await redis.eval(DELETE_ORDER_SCRIPT, 3, orderKey,
    requestLockKey(raw?.gatewayId || '', raw?.requestId || ''),
    `${REDIS_PREFIX.gatewayOrders}:${raw?.gatewayId || ''}`);
}

export async function isRequestLocked(gatewayId: string, requestId: string): Promise<boolean> {
  return (await getRedis().exists(requestLockKey(gatewayId, requestId))) === 1;
}

export async function expirePendingOrders(): Promise<number> {
  const redis = getRedis();
  const now = Date.now();
  let count = 0;
  let cursor = '0';

  do {
    const [newCursor, keys] = await redis.scan(
      cursor, 'MATCH', `${REDIS_PREFIX.order}:*`, 'COUNT', 100
    );
    cursor = newCursor;

    for (const key of keys) {
      const [status, expiresAt, requestId, gatewayId] = await redis.hmget(
        key, 'status', 'expiresAt', 'requestId', 'gatewayId'
      );
      if (status === 'PENDING' && expiresAt && Number(expiresAt) < now) {
        count += await redis.eval(EXPIRE_ORDER_SCRIPT, 2, key,
          requestLockKey(gatewayId || '', requestId || ''), String(now)) as number;
      }
    }
  } while (cursor !== '0');

  return count;
}

export async function listOrdersByGateway(
  gatewayId: string,
  limit = 50,
  offset = 0
): Promise<{ orders: OrderRecord[]; total: number }> {
  const redis = getRedis();
  const all: OrderRecord[] = [];
  let cursor = '0';

  do {
    const [newCursor, keys] = await redis.scan(
      cursor, 'MATCH', `${REDIS_PREFIX.order}:*`, 'COUNT', 100
    );
    cursor = newCursor;
    for (const key of keys) {
      const gw = await redis.hget(key, 'gatewayId');
      if (gw === gatewayId) {
        const raw = await redis.hgetall(key);
        if (raw && Object.keys(raw).length > 0) all.push(deserialize(raw));
      }
    }
  } while (cursor !== '0');

  all.sort((a, b) => b.createdAt - a.createdAt);
  return { orders: all.slice(offset, offset + limit), total: all.length };
}

// ============================================
// 内部
// ============================================

function deserialize(raw: Record<string, string>): OrderRecord {
  return {
    orderId: raw.orderId,
    gatewayId: raw.gatewayId,
    requestId: raw.requestId,
    requestHash: raw.requestHash || '',
    status: raw.status as OrderStatus,
    amount: Number(raw.amount),
    paymentMethod: (raw.paymentMethod as 'alipay' | 'wechat') || 'alipay',
    tradeNo: raw.tradeNo,
    createdAt: Number(raw.createdAt),
    paidAt: raw.paidAt ? Number(raw.paidAt) : undefined,
    expiresAt: Number(raw.expiresAt),
  };
}

function requestLockKey(gatewayId: string, requestId: string): string {
  return `${REDIS_PREFIX.requestLock}:${gatewayId}:${requestId}`;
}
