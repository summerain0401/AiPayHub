import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from 'fastify';
import {
  createOrder, getOrder, deleteOrder, claimPaidOrder,
} from '../services/order.js';
import { getGatewayConfig } from '../services/auth.js';
import { buildUpstreamUrl, buildPaymentUrl } from '../services/proxy.js';
import { generateRequestId } from '../utils/idgen.js';
import type { GatewayConfig, GatewayProxyResponse } from '../types/index.js';
import axios from 'axios';

// ============================================
// 核心网关代理路由
// ============================================
export const registerGatewayRoutes: FastifyPluginAsync = async (app) => {
  /**
   * ALL /{gatewayId}/*
   *
   * 主代理入口:
   * - 无 X-Order-Id → 创建订单，返回 HTTP 402 + paymentUrl
   * - 有 X-Order-Id 且已支付 → 转发到上游 AI
   * - 有 X-Order-Id 但未支付 → 返回 402 pending
   * - 有 X-Order-Id 但已过期/用过 → 返回 402 expired
   */
  app.route({
    method: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    url: '/:gatewayId/*',
    handler: async (request: FastifyRequest, reply: FastifyReply) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const params = request.params as any;
      const gatewayId = params['gatewayId'];
      const requestId = (request.headers['x-request-id'] as string) || generateRequestId();
      const orderId = request.headers['x-order-id'] as string | undefined;

      // 1. 检查网关是否有效
      const gwConfig = await getGatewayConfig(gatewayId);
      if (!gwConfig) {
        return reply.status(404).send({ error: 'gateway_not_found' } as GatewayProxyResponse);
      }
      if (!gwConfig.enabled) {
        return reply.status(403).send({ error: 'gateway_disabled' } as GatewayProxyResponse);
      }

      // 2. 如果携带了 X-Order-Id (已支付重试)
      if (orderId) {
        const order = await getOrder(orderId);

        if (!order || order.status === 'EXPIRED' || order.status === 'DELETED') {
          return reply.status(402)
            .header('Payment-Needed', 'true')
            .send({
              error: 'payment_required',
              message: 'Order expired or invalid. Please start a new request.',
            } as GatewayProxyResponse);
        }

        if (order.status === 'PENDING') {
          return reply.status(402)
            .header('Payment-Needed', buildPaymentUrl(orderId))
            .send({
              error: 'payment_pending',
              orderId,
              paymentUrl: buildPaymentUrl(orderId),
            } as GatewayProxyResponse);
        }

        if (order.status === 'PAID' && order.gatewayId === gatewayId) {
          if (!await claimPaidOrder(orderId, gatewayId)) {
            return reply.status(409).send({ error: 'order_already_consumed_or_expired' });
          }
          // 3. 已支付 — 转发到上游
          return forwardToUpstream(request, reply, gwConfig);
        }

        return reply.status(402)
          .header('Payment-Needed', 'true')
          .send({
            error: 'payment_required',
            message: 'Invalid order for this gateway.',
          } as GatewayProxyResponse);
      }

      // 4. 无 X-Order-Id — 创建订单并返回 402
      try {
        const order = await createOrder(gatewayId, requestId, gwConfig.price);
        const paymentUrl = buildPaymentUrl(order.orderId);

        // 内容锁: 如果客户端 Accept text/markdown，返回 Markdown 付款提示
        const accept = (request.headers['accept'] || '') as string;
        if (accept.includes('text/markdown')) {
          return reply.status(402)
            .header('Content-Type', 'text/markdown')
            .send(markdownPaymentPrompt(paymentUrl, gwConfig.price, order.orderId));
        }

        return reply.status(402)
          .header('Payment-Needed', paymentUrl)
          .send({
            error: 'payment_required',
            paymentUrl,
            orderId: order.orderId,
            amount: gwConfig.price,
          } as GatewayProxyResponse);
      } catch (err) {
        if ((err as Error).message.includes('REQUEST_LOCKED')) {
          return reply.status(429).send({
            error: 'request_already_processing',
            message: 'This request is being processed. Please wait.',
          } as GatewayProxyResponse);
        }
        throw err;
      }
    },
  });

  /**
   * GET /poll/{orderId}
   * 轮询订单状态 (前端 / AI Agent 调用)
   */
  app.get('/poll/:orderId', async (request, reply) => {
    const { orderId } = request.params as { orderId: string };
    const order = await getOrder(orderId);

    if (!order) {
      return reply.status(404).send({ status: 'not_found' });
    }

    return reply.send({
      status: order.status.toLowerCase(),
      orderId: order.orderId,
    });
  });
};

// ============================================
// 上游转发
// ============================================
async function forwardToUpstream(
  request: FastifyRequest,
  reply: FastifyReply,
  gwConfig: GatewayConfig
): Promise<void> {
  const upstreamUrl = buildUpstreamUrl(
    gwConfig.targetUrl,
    request.url
  );

  const orderId = request.headers['x-order-id'] as string;

  try {
    // 使用 axios 转发 (支持 SSE 流式传输)
    const response = await axios({
      method: request.method as string,
      url: upstreamUrl,
      headers: {
        ...filterHeaders(request.headers),
        host: new URL(upstreamUrl).host,
      },
      data: request.body || undefined,
      responseType: 'stream',
      validateStatus: () => true,
    });

    // 透传状态码和响应头
    reply.status(response.status);

    // 透传响应头
    for (const [key, value] of Object.entries(response.headers)) {
      if (key && value) {
        reply.header(key, value as string);
      }
    }

    // 管道化流式转发 (支持 SSE)
    reply.send(response.data);

    // 监听流结束，删除订单 ("一次一毁")
    response.data.on('end', async () => {
      if (orderId) {
        await deleteOrder(orderId);
      }
    });

    response.data.on('error', async () => {
      // 上游传输中断，删除订单回滚
      if (orderId) {
        await deleteOrder(orderId);
      }
    });
  } catch (err) {
    // 上游不可达
    if (orderId) {
      await deleteOrder(orderId);
    }
    throw err;
  }
}

/** 过滤掉不应转发的请求头 */
function filterHeaders(headers: Record<string, string | string[] | undefined>): Record<string, string> {
  const filtered: Record<string, string> = {};
  const skip = new Set([
    'host', 'connection', 'x-order-id', 'x-request-id',
    'admin-secret-key', 'content-length',
  ]);
  for (const [k, v] of Object.entries(headers)) {
    if (!skip.has(k.toLowerCase()) && typeof v === 'string') {
      filtered[k] = v;
    }
  }
  return filtered;
}

/** 生成 Markdown 付款提示 (动态内容锁) */
function markdownPaymentPrompt(
  paymentUrl: string,
  amount: number,
  orderId: string,
): string {
  const priceYuan = (amount / 100).toFixed(2);
  return [
    `## 🔒 Payment Required`,
    ``,
    `This content requires a payment of **¥${priceYuan} CNY** to access.`,
    ``,
    `### Payment Options:`,
    ``,
    `- **H5 (Browser)**: [Open Payment Page](${paymentUrl})`,
    ``,
    `### After Payment:`,
    ``,
    `Retry your request with the following header:`,
    ``,
    `\`\`\``,
    `X-Order-Id: ${orderId}`,
    `\`\`\``,
    ``,
    `> ⏰ This order expires in 5 minutes. `,
    `> 📖 Content is burned after reading — each order works exactly once.`,
  ].join('\n');
}
