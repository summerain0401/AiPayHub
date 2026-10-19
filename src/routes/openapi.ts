import type { FastifyPluginAsync } from 'fastify';
import { getGatewayConfig } from '../services/auth.js';
import { getConfig } from '../config.js';

// ============================================
// OpenAPI Schema — Dify/Coze 一键导入
// ============================================
export const registerOpenapiRoutes: FastifyPluginAsync = async (app) => {
  /**
   * GET /schema/{gatewayId}/openapi.json
   * 生成 OpenAPI 3.0 规范 JSON (Dify/Coze 自定义工具导入用)
   */
  app.get('/:gatewayId/openapi.json', async (request, reply) => {
    const { gatewayId } = request.params as { gatewayId: string };
    const gwConfig = await getGatewayConfig(gatewayId);
    const config = getConfig();

    if (!gwConfig) {
      return reply.status(404).send({ error: 'gateway_not_found' });
    }

    const baseUrl = `${config.gatewayBaseUrl}/${gatewayId}`;

    const schema = {
      openapi: '3.0.1',
      info: {
        title: `AI-Pay Hub Gateway — ${gatewayId}`,
        description: 'AI micro-payment gateway. First call returns HTTP 402; retry the same operation after payment with X-Order-Id header.',
        version: '1.0.0',
      },
      servers: [{ url: baseUrl }],
      paths: {
        '/{proxyPath}': {
          post: {
            summary: 'Proxy request (with payment gate)',
            description: `Send a request through the AI-Pay Hub payment gateway. First call returns 402 with paymentUrl. After paying, retry the same method, path/query, application headers and body with X-Order-Id header.\n\nPrice: ¥${(gwConfig.price / 100).toFixed(2)} per call`,
            parameters: [
              {
                name: 'proxyPath',
                in: 'path',
                required: true,
                schema: { type: 'string' },
                description: 'The path to the upstream API endpoint',
              },
              {
                name: 'X-Request-Id',
                in: 'header',
                required: false,
                schema: { type: 'string' },
                description: 'Unique request ID (auto-generated if missing)',
              },
              {
                name: 'X-Order-Id',
                in: 'header',
                required: false,
                schema: { type: 'string' },
                description: 'Order ID from the previous 402 response (include after payment)',
              },
            ],
            requestBody: {
              required: false,
              content: {
                'application/json': {
                  schema: { type: 'object' },
                },
              },
            },
            responses: {
              '200': { description: 'Payment done — upstream response proxied' },
              '402': { description: 'Payment required — open paymentUrl to pay, then retry with X-Order-Id header' },
              '409': { description: 'Request does not match its order, or the order was already consumed' },
              '429': { description: 'Request already processing — wait and retry' },
            },
          },
        },
        '/poll/{orderId}': {
          get: {
            summary: 'Check payment status',
            parameters: [
              {
                name: 'orderId',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
            ],
            responses: {
              '200': {
                description: 'Payment status',
                content: {
                  'application/json': {
                    schema: {
                      type: 'object',
                      properties: {
                        status: { type: 'string', enum: ['pending', 'paid', 'expired'] },
                        orderId: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    };

    return reply.send(schema);
  });

  /**
   * GET /schema/{gatewayId}
   * Schema 展示页面
   */
  app.get('/:gatewayId', async (request, reply) => {
    const { gatewayId } = request.params as { gatewayId: string };
    const gwConfig = await getGatewayConfig(gatewayId);
    if (!gwConfig) {
      return reply.status(404).send({ error: 'gateway_not_found' });
    }
    return reply.redirect(`/schema/${gatewayId}/openapi.json`);
  });
};
