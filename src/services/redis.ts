import { createRequire } from 'node:module';
import { getConfig } from '../config.js';

// ============================================
// ioredis v5 is CJS — use createRequire for clean import
// ============================================
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const Redis: any = require('ioredis');

// ============================================
// Redis 键名前缀
// ============================================
export const REDIS_PREFIX = {
  order: 'ai-pay:order',
  requestLock: 'ai-pay:req-lock',
  gateway: 'ai-pay:gateway',
  gatewayOrders: 'ai-pay:gw-orders',
} as const;

// ============================================
// Redis 客户端单例
// ============================================
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let client: any = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getRedis(): any {
  if (!client) {
    const config = getConfig();
    client = new Redis(config.redis.url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times: number) {
        if (times > 10) {
          console.error('Redis reconnection failed after 10 attempts');
          return null;
        }
        return Math.min(times * 200, 3000);
      },
    });

    client.on('error', (err: Error) => console.error('Redis error:', err.message));
    client.on('connect', () => console.log('Redis connected'));
  }
  return client;
}

export async function disconnectRedis(): Promise<void> {
  if (client) {
    await client.quit();
    client = null;
  }
}

// ============================================
// 原子 markPaid Lua 脚本
// ============================================
export const MARK_PAID_SCRIPT = `
local order_key = KEYS[1]
local lock_key = KEYS[2]
local trade_no = ARGV[1]
local paid_at = ARGV[2]
local amount = ARGV[3]

local current = redis.call('HGET', order_key, 'status')
if redis.call('HGET', order_key, 'amount') ~= amount then return 0 end
if (current == 'PAID' or current == 'PROCESSING') and redis.call('HGET', order_key, 'tradeNo') == trade_no then return 2 end
if current == 'PENDING' then
  if tonumber(redis.call('HGET', order_key, 'expiresAt') or '0') <= tonumber(paid_at) then return 0 end
  redis.call('HSET', order_key, 'status', 'PAID', 'paidAt', paid_at, 'tradeNo', trade_no, 'expiresAt', tonumber(paid_at) + 300000)
  redis.call('PEXPIRE', order_key, 300000)
  if lock_key ~= '' then redis.call('DEL', lock_key) end
  return 1
end
return 0
`;

// Claim before contacting the upstream: concurrent retries can consume only once.
export const CLAIM_PAID_SCRIPT = `
if redis.call('HGET', KEYS[1], 'status') ~= 'PAID' then return 0 end
if redis.call('HGET', KEYS[1], 'gatewayId') ~= ARGV[1] then return 0 end
if tonumber(redis.call('HGET', KEYS[1], 'expiresAt') or '0') <= tonumber(ARGV[2]) then return 0 end
redis.call('HSET', KEYS[1], 'status', 'PROCESSING')
return 1
`;
