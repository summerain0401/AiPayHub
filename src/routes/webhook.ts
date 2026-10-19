import type { FastifyPluginAsync } from 'fastify';
import { getPaymentProvider } from '../services/payment.js';
import { getWebhookQueue } from '../utils/queue.js';

// ============================================
// Webhook 回调路由
// ============================================
export const registerWebhookRoutes: FastifyPluginAsync = async (app) => {
  app.addContentTypeParser('application/x-www-form-urlencoded', { parseAs: 'string' }, (_request, body, done) => {
    const params = new URLSearchParams(body as string);
    const payload: Record<string, string> = {};
    for (const [key, value] of params) {
      if (Object.hasOwn(payload, key)) return done(new Error('duplicate notification field'));
      payload[key] = value;
    }
    done(null, payload);
  });
  /**
   * POST /webhook/alipay
   * 支付宝异步通知
   */
  app.post('/alipay', async (request, reply) => {
    const payload = request.body as Record<string, string>;
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)
      || Object.values(payload).some((value) => typeof value !== 'string')) {
      return reply.status(400).send({ error: 'invalid_payload' });
    }
    const provider = getPaymentProvider('alipay_x402');
    if (!provider) {
      return reply.status(500).send({ error: 'no_payment_provider' });
    }

    const result = await provider.verifyWebhook(payload);

    if (!result.valid) {
      return reply.status(400).send({ error: 'invalid_signature' });
    }

    if (result.status !== 'success') return reply.send('success');

    // Acknowledge only after Redis has accepted the notification.
    await getWebhookQueue().enqueue(
      {
        orderId: result.orderId,
        tradeNo: result.tradeNo,
        amount: result.amount,
        status: result.status,
        sign: payload['sign'] || '',
      },
      'alipay_x402'
    );

    // 支付宝要求返回 "success" 字符串
    return reply.send('success');
  });

};

// ============================================
// 初始化 Webhook 队列处理
// ============================================
export function startWebhookProcessing(): void {
  getWebhookQueue().start();
}
