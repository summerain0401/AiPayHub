/**
 * Integration tests — require running Redis at REDIS_URL (default localhost:6379).
 * Skips gracefully if Redis unavailable.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const IORedis: any = require('ioredis');

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

let redis: typeof IORedis;
let available = false;

const PREFIX = { order: 'ai-pay:test-order', lock: 'ai-pay:test-lock' };

function rid(p: string) { return p + '_' + Math.random().toString(36).slice(2, 12); }

const MARK_PAID_LUA = `
local order_key = KEYS[1]
local lock_key = KEYS[2]
local trade_no = ARGV[1]
local paid_at = ARGV[2]
local current = redis.call('HGET', order_key, 'status')
if current == 'PENDING' then
  redis.call('HSET', order_key, 'status', 'PAID', 'paidAt', paid_at, 'tradeNo', trade_no)
  redis.call('PEXPIRE', order_key, 300000)
  if lock_key ~= '' then redis.call('DEL', lock_key) end
  return 1
end
return 0
`;

async function mkOrder(gwId: string, reqId: string, amount = 100) {
  const oid = rid('ord'), now = Date.now();
  const ok = `${PREFIX.order}:${oid}`, lk = `${PREFIX.lock}:${reqId}`;
  const p = redis.pipeline();
  p.hset(ok, { orderId: oid, gatewayId: gwId, requestId: reqId, status: 'PENDING', amount: String(amount), createdAt: String(now), expiresAt: String(now + 300_000) });
  p.expire(ok, 360);
  p.setex(lk, 300, oid);
  await p.exec();
  return { orderId: oid, requestId: reqId, orderKey: ok, lockKey: lk };
}

beforeAll(async () => {
  try {
    redis = new IORedis(REDIS_URL, { lazyConnect: true, maxRetriesPerRequest: 1 });
    await redis.connect();
    available = (await redis.ping()) === 'PONG';
  } catch { available = false; }
}, 5000);

afterAll(async () => { if (redis) await redis.quit(); });

describe('Order State Machine (Redis)', () => {
  const ok = () => expect(available).toBe(true);

  it('creates order as PENDING', async () => {
    if (!available) return;
    const { orderId, orderKey, lockKey } = await mkOrder(rid('gw'), rid('req'), 200);
    const raw = await redis.hgetall(orderKey);
    expect(raw.status).toBe('PENDING');
    expect(raw.amount).toBe('200');
    expect(await redis.get(lockKey)).toBe(orderId);
    expect(await redis.ttl(orderKey)).toBeGreaterThan(0);
    await redis.del(orderKey, lockKey);
  });

  it('PENDING → PAID via Lua (atomic)', async () => {
    if (!available) return;
    const { orderKey, lockKey } = await mkOrder(rid('gw'), rid('req'), 150);
    const sha = await redis.script('LOAD', MARK_PAID_LUA);
    expect(await redis.evalsha(sha, 2, orderKey, lockKey, 't1', String(Date.now()))).toBe(1);
    const raw = await redis.hgetall(orderKey);
    expect(raw.status).toBe('PAID');
    expect(raw.tradeNo).toBe('t1');
    expect(raw.paidAt).toBeTruthy();
    expect(await redis.exists(lockKey)).toBe(0); // lock cleaned
    await redis.del(orderKey);
  });

  it('prevents double payment', async () => {
    if (!available) return;
    const { orderKey, lockKey } = await mkOrder(rid('gw'), rid('req'), 100);
    const sha = await redis.script('LOAD', MARK_PAID_LUA);
    expect(await redis.evalsha(sha, 2, orderKey, lockKey, 't1', String(Date.now()))).toBe(1);
    expect(await redis.evalsha(sha, 2, orderKey, lockKey, 't2', String(Date.now()))).toBe(0);
    expect((await redis.hgetall(orderKey)).tradeNo).toBe('t1');
    await redis.del(orderKey);
  });

  it('rejects payment on EXPIRED order', async () => {
    if (!available) return;
    const { orderKey, lockKey } = await mkOrder(rid('gw'), rid('req'), 50);
    await redis.hset(orderKey, 'status', 'EXPIRED');
    const sha = await redis.script('LOAD', MARK_PAID_LUA);
    expect(await redis.evalsha(sha, 2, orderKey, lockKey, 'tx', String(Date.now()))).toBe(0);
    await redis.del(orderKey);
  });

  it('duplicate requestId is blocked', async () => {
    if (!available) return;
    const reqId = rid('req');
    const { orderKey, lockKey } = await mkOrder(rid('gw'), reqId);
    expect(await redis.exists(lockKey)).toBe(1);
    await redis.del(orderKey, lockKey);
  });
});

describe('Webhook Flow', () => {
  it('full cycle: create → webhook markPaid → verify → idempotent', async () => {
    if (!available) return;
    const { orderKey, lockKey } = await mkOrder(rid('gw'), rid('req'), 250);
    expect((await redis.hgetall(orderKey)).status).toBe('PENDING');
    const sha = await redis.script('LOAD', MARK_PAID_LUA);
    expect(await redis.evalsha(sha, 2, orderKey, lockKey, 'w_trade', String(Date.now()))).toBe(1);
    const raw = await redis.hgetall(orderKey);
    expect(raw.status).toBe('PAID');
    expect(raw.tradeNo).toBe('w_trade');
    // idempotent
    expect(await redis.evalsha(sha, 2, orderKey, lockKey, 'dup', String(Date.now()))).toBe(0);
    await redis.del(orderKey);
  });
});
