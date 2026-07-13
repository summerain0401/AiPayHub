import { getRedis, REDIS_PREFIX, MARK_PAID_SCRIPT } from './redis.js';
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
  method: 'alipay' | 'wechat' = 'alipay'
): Promise<OrderRecord> {
  const redis = getRedis();
  const orderId = generateOrderId();
  const now = Date.now();

  // 检查请求锁
  const lockKey = `${REDIS_PREFIX.requestLock}:${requestId}`;
  if (await redis.exists(lockKey)) {
    throw new Error('REQUEST_LOCKED: duplicate request');
  }

  const order: OrderRecord = {
    orderId,
    gatewayId,
    requestId,
    status: 'PENDING',
    amount,
    paymentMethod: method,
    createdAt: now,
    expiresAt: now + ORDER_TTL_SECONDS * 1000,
  };

  const orderKey = `${REDIS_PREFIX.order}:${orderId}`;
  const pipe = redis.pipeline();
  pipe.hset(orderKey, {
    orderId, gatewayId, requestId,
    status: 'PENDING',
    amount: String(amount),
    paymentMethod: method,
    createdAt: String(now),
    expiresAt: String(order.expiresAt),
  });
  pipe.expire(orderKey, ORDER_TTL_SECONDS + 60);
  pipe.sadd(`${REDIS_PREFIX.gatewayOrders}:${gatewayId}`, orderId);
  pipe.setex(lockKey, ORDER_TTL_SECONDS, orderId);
  await pipe.exec();

  return order;
}

export async function markPaid(
  orderId: string,
  tradeNo: string
): Promise<OrderRecord | null> {
  const redis = getRedis();
  const orderKey = `${REDIS_PREFIX.order}:${orderId}`;
  const requestId = await redis.hget(orderKey, 'requestId');
  const requestLockKey = requestId
    ? `${REDIS_PREFIX.requestLock}:${requestId}`
    : `${REDIS_PREFIX.requestLock}:${orderId}`;
  const paidAt = String(Date.now());
  const sha = await getMarkPaidSha();

  const result = await redis.evalsha(
    sha, 2, orderKey, requestLockKey, tradeNo, paidAt
  ) as number;

  if (result === 0) return null;
  return getOrder(orderId);
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
  if (raw?.requestId) {
    await redis.del(`${REDIS_PREFIX.requestLock}:${raw.requestId}`);
  }
  if (raw?.gatewayId) {
    await redis.srem(`${REDIS_PREFIX.gatewayOrders}:${raw.gatewayId}`, orderId);
  }
  await redis.del(orderKey);
}

export async function isRequestLocked(requestId: string): Promise<boolean> {
  return (await getRedis().exists(`${REDIS_PREFIX.requestLock}:${requestId}`)) === 1;
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
      const [status, expiresAt, requestId] = await redis.hmget(
        key, 'status', 'expiresAt', 'requestId'
      );
      if (status === 'PENDING' && expiresAt && Number(expiresAt) < now) {
        await redis.hset(key, 'status', 'EXPIRED');
        if (requestId) {
          await redis.del(`${REDIS_PREFIX.requestLock}:${requestId}`);
        }
        count++;
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
    status: raw.status as OrderStatus,
    amount: Number(raw.amount),
    paymentMethod: (raw.paymentMethod as 'alipay' | 'wechat') || 'alipay',
    tradeNo: raw.tradeNo,
    createdAt: Number(raw.createdAt),
    paidAt: raw.paidAt ? Number(raw.paidAt) : undefined,
    expiresAt: Number(raw.expiresAt),
  };
}
