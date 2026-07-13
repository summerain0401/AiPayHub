import type { FastifyRequest, FastifyReply } from 'fastify';
import { getRedis } from '../services/redis.js';
import { getConfig } from '../config.js';

// ============================================
// Redis-backed IP rate limiter
// ============================================

export async function rateLimit(request: FastifyRequest, reply: FastifyReply) {
  const rpm = getConfig().rateLimit.rpm;
  const ip = request.ip || 'unknown';
  const key = `ai-pay:ratelimit:${ip}`;

  const redis = getRedis();
  const hits = await redis.incr(key);
  if (hits === 1) await redis.expire(key, 60);
  if (hits > rpm) {
    const ttl = await redis.ttl(key);
    return reply.status(429).send({
      error: 'rate_limit_exceeded',
      retryAfter: ttl > 0 ? ttl : 60,
    });
  }
}
