import { getConfig } from '../config.js';

// ============================================
// 反向代理服务 — 请求挂起/放行/上游转发
// ============================================

interface SuspendedRequest {
  resolve: () => void;
  reject: (err: Error) => void;
  timestamp: number;
}

const suspended = new Map<string, SuspendedRequest>();
const MAX_SUSPENDED = 10_000;
const SUSPEND_TIMEOUT_MS = 300_000; // 5 min

/** 挂起请求，等待支付完成。返回 Promise，resume() 时 resolve */
export function suspend(requestId: string): Promise<void> {
  if (suspended.size >= MAX_SUSPENDED) {
    const oldest = [...suspended.entries()]
      .sort((a, b) => a[1].timestamp - b[1].timestamp)[0];
    if (oldest) {
      oldest[1].reject(new Error('SUSPEND_EVICTED'));
      suspended.delete(oldest[0]);
    }
  }

  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      suspended.delete(requestId);
      reject(new Error('SUSPEND_TIMEOUT'));
    }, SUSPEND_TIMEOUT_MS);

    suspended.set(requestId, {
      resolve: () => { clearTimeout(timer); resolve(); },
      reject: (err) => { clearTimeout(timer); reject(err); },
      timestamp: Date.now(),
    });
  });
}

/** 放行挂起的请求 */
export function resume(requestId: string): boolean {
  const entry = suspended.get(requestId);
  if (!entry) return false;
  entry.resolve();
  suspended.delete(requestId);
  return true;
}

/** 取消挂起的请求 */
export function cancel(requestId: string): void {
  const entry = suspended.get(requestId);
  if (entry) {
    entry.reject(new Error('SUSPEND_CANCELLED'));
    suspended.delete(requestId);
  }
}

export function getSuspendedCount(): number {
  return suspended.size;
}

/** 构建上游 URL: 去掉 gatewayId 前缀 */
export function buildUpstreamUrl(targetUrl: string, path: string): string {
  const base = targetUrl.replace(/\/$/, '');
  const slash = path.indexOf('/', 1);
  const query = path.indexOf('?');
  const upstreamPath = slash >= 0 && (query < 0 || slash < query)
    ? path.slice(slash)
    : '/' + (query >= 0 ? path.slice(query) : '');
  return base + upstreamPath;
}

/** 生成支付页 URL */
export function buildPaymentUrl(orderId: string): string {
  const config = getConfig();
  return `${config.gatewayBaseUrl}/pay/${orderId}`;
}
