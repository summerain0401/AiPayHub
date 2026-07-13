import { describe, it, expect, beforeEach } from 'vitest';

// ============================================
// 订单状态机纯逻辑测试 (内存 mock，无需 Redis)
// ============================================

class MockOrderStore {
  private orders = new Map<string, Record<string, string>>();
  private locks = new Set<string>();

  createOrder(gatewayId: string, requestId: string, amount: number) {
    if (this.locks.has(requestId)) {
      throw new Error('REQUEST_LOCKED: duplicate request');
    }
    const orderId = `ord_${Math.random().toString(36).slice(2, 10)}`;
    const now = Date.now();
    this.orders.set(orderId, {
      orderId, gatewayId, requestId,
      status: 'PENDING',
      amount: String(amount),
      paymentMethod: 'alipay',
      createdAt: String(now),
      expiresAt: String(now + 300_000),
    });
    this.locks.add(requestId);
    return { orderId, status: 'PENDING' as const };
  }

  markPaid(orderId: string): 'ok' | 'not_pending' | 'not_found' {
    const order = this.orders.get(orderId);
    if (!order) return 'not_found';
    if (order.status !== 'PENDING') return 'not_pending';
    order.status = 'PAID';
    order.paidAt = String(Date.now());
    order.tradeNo = 'trade_001';
    return 'ok';
  }

  getStatus(orderId: string): string | null {
    return this.orders.get(orderId)?.status ?? null;
  }

  deleteOrder(orderId: string) {
    const order = this.orders.get(orderId);
    if (order) {
      this.locks.delete(order.requestId);
      this.orders.delete(orderId);
    }
  }

  expire(now: number) {
    for (const [id, o] of this.orders) {
      if (o.status === 'PENDING' && Number(o.expiresAt) < now) {
        o.status = 'EXPIRED';
        this.locks.delete(o.requestId);
      }
    }
  }
}

describe('Order State Machine', () => {
  let store: MockOrderStore;

  beforeEach(() => {
    store = new MockOrderStore();
  });

  it('PENDING -> PAID (happy path)', () => {
    const { orderId } = store.createOrder('gw_A', 'req_1', 200);
    expect(store.getStatus(orderId)).toBe('PENDING');
    expect(store.markPaid(orderId)).toBe('ok');
    expect(store.getStatus(orderId)).toBe('PAID');
  });

  it('prevents double payment (PAID -> PAID rejected)', () => {
    const { orderId } = store.createOrder('gw_A', 'req_2', 100);
    store.markPaid(orderId);
    expect(store.markPaid(orderId)).toBe('not_pending');
  });

  it('rejects duplicate requestId (anti-abuse)', () => {
    store.createOrder('gw_A', 'req_dup', 50);
    expect(() => store.createOrder('gw_A', 'req_dup', 50)).toThrow('REQUEST_LOCKED');
  });

  it('expires overdue orders', () => {
    const { orderId } = store.createOrder('gw_A', 'req_exp', 300);
    expect(store.getStatus(orderId)).toBe('PENDING');
    store.expire(Date.now() + 360_000);
    expect(store.getStatus(orderId)).toBe('EXPIRED');
    expect(store.markPaid(orderId)).toBe('not_pending');
  });

  it('deleteOrder releases request lock', () => {
    const { orderId } = store.createOrder('gw_A', 'req_del', 100);
    store.deleteOrder(orderId);
    expect(store.getStatus(orderId)).toBeNull();
    const { orderId: newId } = store.createOrder('gw_A', 'req_del', 100);
    expect(newId).not.toBe(orderId);
  });

  it('returns null for nonexistent order', () => {
    expect(store.getStatus('ord_fake')).toBeNull();
    expect(store.markPaid('ord_fake')).toBe('not_found');
  });
});
