import { getRedis } from '../services/redis.js';
import type { WebhookPayload } from '../types/index.js';

// ============================================
// Redis-backed Webhook Queue (persistent)
// ============================================

const Q = 'ai-pay:webhook-queue';
const PROCESSING = 'ai-pay:webhook-processing';
const RETRIES = 'ai-pay:webhook-retries';
const DEAD = 'ai-pay:webhook-dead';
const MAX = 3;
const BACKOFF = [1000, 5000, 30000];

type Item = { payload: WebhookPayload; provider: string };

export class WebhookQueue {
  private running = false;

  async enqueue(payload: WebhookPayload, provider: string): Promise<void> {
    await getRedis().lpush(Q, JSON.stringify({ payload, provider }));
  }

  start(): void { this.running = true; void this.consume(); }
  stop(): void { this.running = false; }
  async getLength(): Promise<number> { return getRedis().llen(Q); }
  async getDeadLength(): Promise<number> { return getRedis().llen(DEAD); }

  private async consume(): Promise<void> {
    const redis = getRedis();
    while (this.running) {
      try {
        const r = await redis.brpop(Q, 2) as [string, string] | null;
        if (!r) continue;
        const raw = r[1]; const item: Item = JSON.parse(raw);
        await redis.sadd(PROCESSING, raw);
        try {
          await this.process(item);
          await redis.srem(PROCESSING, raw);
          await redis.hdel(RETRIES, item.payload.orderId);
        } catch {
          await redis.srem(PROCESSING, raw);
          const n = await redis.hincrby(RETRIES, item.payload.orderId, 1) as number;
          if (n <= MAX) {
            await new Promise((resolve) => setTimeout(resolve, BACKOFF[n - 1] || 30000));
            await redis.lpush(Q, raw);
          } else {
            await redis.lpush(DEAD, raw);
            await redis.hdel(RETRIES, item.payload.orderId);
            console.error(`Webhook dead: ${item.payload.orderId}`);
          }
        }
      } catch { await new Promise((r) => setTimeout(r, 1000)); }
    }
  }

  async replayDead(): Promise<number> {
    const redis = getRedis(); let c = 0;
    while (true) { const r = await redis.rpop(DEAD); if (!r) break; await redis.lpush(Q, r); c++; }
    return c;
  }

  async recoverProcessing(): Promise<number> {
    const redis = getRedis(); let c = 0;
    const items = await redis.smembers(PROCESSING) as string[];
    for (const raw of items) { await redis.lpush(Q, raw); await redis.srem(PROCESSING, raw); c++; }
    return c;
  }

  private async process(item: Item): Promise<void> {
    if (item.provider !== 'alipay_x402' || item.payload.status !== 'success') return;
    const { markPaid } = await import('../services/order.js');
    // Mismatched amounts, expired/missing orders and duplicates are terminal.
    // Redis/network errors still throw and use the retry/dead-letter path.
    await markPaid(item.payload.orderId, item.payload.tradeNo, item.payload.amount);
  }
}

let _q: WebhookQueue | null = null;
export function getWebhookQueue(): WebhookQueue {
  if (!_q) _q = new WebhookQueue();
  return _q;
}
