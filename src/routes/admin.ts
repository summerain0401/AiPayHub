import type { FastifyPluginAsync } from 'fastify';
import { requireAdmin } from '../middleware/auth.js';
import { listOrdersByGateway } from '../services/order.js';
import type { DashboardStats, OrderListResponse } from '../types/index.js';

// ============================================
// 管理看板 API
// ============================================
export const registerAdminRoutes: FastifyPluginAsync = async (app) => {
  app.addHook('preHandler', requireAdmin());
  /**
   * GET /dash/stats
   * 仪表盘统计 (需要 gatewayId query + Admin-Secret-Key header)
   */
  app.get('/stats', async (request, reply) => {
    const gatewayId = request.gatewayConfig!.gatewayId;
    const { orders, total } = await listOrdersByGateway(gatewayId, 1000, 0);

    const stats: DashboardStats = {
      totalOrders: total,
      totalRevenue: orders
        .filter((o) => o.status === 'PAID')
        .reduce((sum, o) => sum + o.amount, 0),
      paidOrders: orders.filter((o) => o.status === 'PAID').length,
      pendingOrders: orders.filter((o) => o.status === 'PENDING').length,
    };

    return reply.send(stats);
  });

  /**
   * GET /dash/orders
   * 订单列表
   */
  app.get('/orders', async (request, reply) => {
    const gatewayId = request.gatewayConfig!.gatewayId;
    const { limit, offset } = request.query as Record<string, string>;
    const result = await listOrdersByGateway(
      gatewayId,
      limit ? parseInt(limit, 10) : 50,
      offset ? parseInt(offset, 10) : 0
    );

    return reply.send({
      orders: result.orders,
      total: result.total,
      offset: offset ? parseInt(offset, 10) : 0,
      limit: limit ? parseInt(limit, 10) : 50,
    } as OrderListResponse);
  });

  /**
   * GET /dash/gateway
   * 获取网关信息
   */
  app.get('/gateway', async (request, reply) => {
    const gateway = request.gatewayConfig!;
    return reply.send({
      gatewayId: gateway.gatewayId,
      targetUrl: gateway.targetUrl,
      price: gateway.price / 100,
      enabled: gateway.enabled,
      createdAt: gateway.createdAt,
    });
  });
};
