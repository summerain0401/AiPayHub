import type { FastifyPluginAsync } from 'fastify';
import { getPaymentProvider } from '../services/payment.js';
import { markPaid } from '../services/order.js';
import { getWebhookQueue } from '../utils/queue.js';

// ============================================
// Webhook 回调路由
// ============================================
export const registerWebhookRoutes: FastifyPluginAsync = async (app) => {
  /**
   * POST /webhook/alipay
   * 支付宝异步通知
   */
  app.post('/alipay', async (request, reply) => {
    const payload = request.body as Record<string, string>;
    const provider = getPaymentProvider('alipay_x402');
    if (!provider) {
      return reply.status(500).send({ error: 'no_payment_provider' });
    }

    const result = await provider.verifyWebhook(payload);

    if (!result.valid) {
      return reply.status(400).send({ error: 'invalid_signature' });
    }

    // 入队异步处理
    getWebhookQueue().enqueue(
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

  /**
   * POST /webhook/test
   * 测试用: 手动触发订单标记为已支付
   */
  app.post('/test', async (request, reply) => {
    const body = request.body as { orderId: string; tradeNo?: string };
    if (!body.orderId) {
      return reply.status(400).send({ error: 'missing orderId' });
    }

    const result = await markPaid(
      body.orderId,
      body.tradeNo || 'test_trade_' + Date.now()
    );

    if (!result) {
      return reply.status(400).send({
        error: 'mark_paid_failed',
        message: 'Order not in PENDING status or not found',
      });
    }

    return reply.send({ success: true, order: result });
  });
};

// ============================================
// 初始化 Webhook 队列处理
// ============================================
export function startWebhookProcessing(): void {
  getWebhookQueue().start();
}
