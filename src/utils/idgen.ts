import { nanoid } from 'nanoid';

// ============================================
// ID 生成器 — 统一格式，URL-safe
// ============================================

/** 公开网关路由标识: gw_ + 24位 base62 */
export function generateGatewayId(): string {
  return `gw_${nanoid(24)}`;
}

/** 管理密钥: ask_ + 32位 base62 */
export function generateAdminKey(): string {
  return `ask_${nanoid(32)}`;
}

/** 请求 ID: req_ + 12位 base62 */
export function generateRequestId(): string {
  return `req_${nanoid(12)}`;
}

/** 订单 ID: ord_ + 16位 base62 */
export function generateOrderId(): string {
  return `ord_${nanoid(16)}`;
}
