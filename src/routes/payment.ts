import type { FastifyPluginAsync } from 'fastify';
import { getOrder } from '../services/order.js';
import { getDefaultProvider } from '../services/payment.js';

export const registerPaymentRoutes: FastifyPluginAsync = async (app) => {
  /** GET /pay/{orderId} — browser gets HTML, AI gets JSON */
  app.get('/:orderId', async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const accept = (request.headers['accept'] || '') as string;

    const order = await getOrder(orderId);

    // Browser → HTML payment page
    if (accept.includes('text/html')) {
      return reply.sendFile('payment.html');
    }

    // AI client → JSON
    if (!order) return reply.status(404).send({ error: 'order_not_found' });
    if (order.status !== 'PENDING') {
      return reply.status(400).send({ error: 'order_not_pending', status: order.status });
    }

    const provider = getDefaultProvider();
    if (!provider) return reply.status(500).send({ error: 'no_payment_provider' });

    const result = await provider.createPayment({
      orderId: order.orderId, gatewayId: order.gatewayId,
      amount: order.amount, subject: 'AI API Call', method: 'alipay',
    });

    if (!result.success) return reply.status(500).send({ error: result.errorMessage || 'payment failed' });
    return reply.send({ orderId, x402Url: result.x402Url, expiresAt: order.expiresAt, amount: order.amount });
  });

  /**
   * GET /pay/{orderId}/status
   * 查询支付状态 (轮询用)
   */
  app.get('/:orderId/status', async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const order = await getOrder(orderId);

    if (!order) {
      return reply.status(404).send({ error: 'order_not_found' });
    }

    return reply.send({
      status: order.status.toLowerCase(),
      orderId,
      amount: order.amount,
      expiresAt: order.expiresAt,
      paidAt: order.paidAt || null,
    });
  });

  /**
   * GET /pay/{orderId}/callback
   * 支付完成回调页
   */
  app.get('/:orderId/callback', async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const order = await getOrder(orderId);

    if (!order) {
      return reply.send({ status: 'not_found' });
    }

    if (order.status === 'PAID') {
      return reply.send({
        status: 'paid',
        message: 'Payment successful. Retry your request with header X-Order-Id: ' + orderId,
      });
    }

    return reply.send({ status: order.status.toLowerCase() });
  });
};
