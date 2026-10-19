// ============================================
// AI-Pay Hub 共享类型定义
// ============================================

// ---- 网关配置 ----
export interface GatewayConfig {
  gatewayId: string;
  adminKeyHash: string;
  targetUrl: string;
  tierId: string;           // 价格档位 ID, e.g. "tier_100"
  price: number;            // 每次调用价格 (单位: 分, 从 tier 计算)
  creatorEmail?: string;
  alipayAccount?: string;   // 创作者支付宝账号 (用于结算)
  createdAt: number;
  enabled: boolean;
}

// ---- 订单状态机 ----
export type OrderStatus = 'PENDING' | 'PAID' | 'PROCESSING' | 'DELETED' | 'EXPIRED';

export interface OrderRecord {
  orderId: string;
  gatewayId: string;
  requestId: string;
  status: OrderStatus;
  amount: number;           // 单位: 分
  paymentMethod: 'alipay' | 'wechat';
  tradeNo?: string;         // 支付平台交易号
  createdAt: number;        // Unix ms
  paidAt?: number;          // Unix ms
  expiresAt: number;        // Unix ms
}

// ---- 支付抽象 ----
export interface PaymentRequest {
  orderId: string;
  gatewayId: string;
  amount: number;           // 单位: 分
  subject: string;          // 商品描述
  method: 'alipay' | 'wechat';
  returnUrl?: string;
}

export interface PaymentResult {
  success: boolean;
  x402Url?: string;         // X402 协议支付链接
  tradeNo?: string;
  errorMessage?: string;
}

export interface WebhookPayload {
  orderId: string;
  tradeNo: string;
  amount: number;
  status: 'success' | 'fail';
  sign: string;
}

export interface WebhookResult {
  valid: boolean;
  orderId: string;
  tradeNo: string;
  amount: number;           // integer CNY cents, matching OrderRecord.amount
  status: 'success' | 'fail';
}

export interface PaymentProvider {
  name: string;
  createPayment(request: PaymentRequest): Promise<PaymentResult>;
  verifyWebhook(payload: Record<string, string>): Promise<WebhookResult>;
}

// ---- API 请求/响应 ----
export interface CreateGatewayRequest {
  targetUrl: string;
  tierId: string;           // 档位 ID
  creatorEmail?: string;
  alipayAccount?: string;   // 结算支付宝账号
}

export interface CreateGatewayResponse {
  gatewayId: string;
  adminKey: string;
  targetUrl: string;
  tierId: string;
  price: number;            // 对应的价格 (分)
}

export interface GatewayProxyResponse {
  error?: string;
  paymentUrl?: string;
  orderId?: string;
  message?: string;
}

// ---- 仪表盘 ----
export interface OrderListResponse {
  orders: OrderRecord[];
  total: number;
  offset: number;
  limit: number;
}

export interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;     // 单位: 分
  paidOrders: number;
  pendingOrders: number;
}
