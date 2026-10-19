import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getConfig } from './config.js';
import { expirePendingOrders } from './services/order.js';
import { initPaymentService } from './services/payment.js';
import { startWebhookProcessing, registerWebhookRoutes } from './routes/webhook.js';
import { getWebhookQueue } from './utils/queue.js';
import { registerGatewayRoutes } from './routes/gateway.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerGeneratorRoutes } from './routes/generator.js';
import { registerPaymentRoutes } from './routes/payment.js';
import { registerOpenapiRoutes } from './routes/openapi.js';
import { loggerOptions } from './utils/logging.js';

async function main() {
  const config = getConfig();

  const app = Fastify({ logger: loggerOptions });

  // ---- CORS ----
  await app.register(cors, { origin: '*' });

  // ---- 初始化服务 ----
  initPaymentService();
  startWebhookProcessing();
  const recovered = await getWebhookQueue().recoverProcessing();
  if (recovered > 0) app.log.info(`Recovered ${recovered} stale webhook items`);

  // ---- 健康检查 ----
  app.get('/ping', async () => ({
    status: 'ok',
    timestamp: Date.now(),
    uptime: process.uptime(),
  }));

  // ---- 静态文件 @fastify/static 放在路由之前，优先匹配 ----
  const __dirname = dirname(fileURLToPath(import.meta.url));
  await app.register(fastifyStatic, {
    root: join(__dirname, '..', 'public'),
    prefix: '/',
    wildcard: false,
  });

  // ---- 页面快捷路由 (在 API 插件之前注册) ----
  app.get('/generator', (_req, reply) => reply.redirect('/generator.html'));
  app.get('/dash', (_req, reply) => reply.redirect('/dashboard.html'));
  app.get('/dify-guide', (_req, reply) => reply.redirect('/dify-guide.html'));
  app.get('/markdown-lock-guide', (_req, reply) => reply.redirect('/markdown-lock-guide.html'));

  // ---- API 路由 ----
  await app.register(registerAdminRoutes, { prefix: '/dash' });
  await app.register(registerGeneratorRoutes, { prefix: '/generate' });
  await app.register(registerPaymentRoutes, { prefix: '/pay' });
  await app.register(registerWebhookRoutes, { prefix: '/webhook' });
  await app.register(registerOpenapiRoutes, { prefix: '/schema' });
  // 网关代理必须在最后 (catch-all)
  await app.register(registerGatewayRoutes, { prefix: '/' });

  // ---- 全局错误处理 ----
  app.setErrorHandler((err, _request, reply) => {
    const error = err as Error & { statusCode?: number };
    app.log.error(error);
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      error: error.message || 'Internal Server Error',
      statusCode,
    });
  });

  // ---- 定时清理过期订单 ----
  const cleanupInterval = setInterval(async () => {
    try {
      const expired = await expirePendingOrders();
      if (expired > 0) app.log.info(`Cleanup: ${expired} expired orders`);
    } catch (err) {
      app.log.error({ err }, 'Order cleanup failed');
    }
  }, 60_000);

  // ---- 优雅关闭 ----
  const shutdown = async (signal: string) => {
    app.log.info(`Received ${signal}, shutting down...`);
    clearInterval(cleanupInterval);
    await app.close();
    process.exit(0);
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  // ---- 启动 ----
  try {
    await app.listen({ port: config.port, host: '0.0.0.0' });
    app.log.info(`AI-Pay Hub ready: http://localhost:${config.port}`);
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }
}

main();
