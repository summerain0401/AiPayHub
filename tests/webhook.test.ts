import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Fastify from 'fastify';
import { registerWebhookRoutes } from '../src/routes/webhook.js';

const { verify, enqueue } = vi.hoisted(() => ({ verify: vi.fn(), enqueue: vi.fn() }));
vi.mock('../src/services/payment.js', () => ({ getPaymentProvider: () => ({ verifyWebhook: verify }) }));
vi.mock('../src/utils/queue.js', () => ({ getWebhookQueue: () => ({ enqueue }) }));

describe('Notification HTTP boundary', () => {
  let app: ReturnType<typeof Fastify>;
  beforeEach(async () => {
    vi.resetAllMocks();
    verify.mockResolvedValue({ valid: true, status: 'success', orderId: 'order-test', tradeNo: 'trade-test', amount: 100 });
    enqueue.mockResolvedValue(undefined);
    app = Fastify();
    await app.register(registerWebhookRoutes, { prefix: '/webhook' });
  });
  afterEach(async () => { await app.close(); });
  it('has no endpoint granting payment without a signed notification', async () => {
    expect((await app.inject({ method: 'POST', url: '/webhook/test', payload: { orderId: 'order-test' } })).statusCode).toBe(404);
    expect(enqueue).not.toHaveBeenCalled();
  });
  it('rejects invalid signatures before enqueueing', async () => {
    verify.mockResolvedValue({ valid: false });
    expect((await app.inject({ method: 'POST', url: '/webhook/alipay', payload: { sign: 'invalid' } })).statusCode).toBe(400);
    expect(enqueue).not.toHaveBeenCalled();
  });
  it('acknowledges unsuccessful trades without granting payment', async () => {
    verify.mockResolvedValue({ valid: true, status: 'fail' });
    expect((await app.inject({ method: 'POST', url: '/webhook/alipay', payload: {} })).body).toBe('success');
    expect(enqueue).not.toHaveBeenCalled();
  });
  it('parses Alipay form notifications and queues integer cents', async () => {
    const response = await app.inject({ method: 'POST', url: '/webhook/alipay',
      headers: { 'content-type': 'application/x-www-form-urlencoded' }, payload: 'out_trade_no=order-test&sign=a%2Bb' });
    expect(verify).toHaveBeenCalledWith({ out_trade_no: 'order-test', sign: 'a+b' });
    expect(enqueue).toHaveBeenCalledWith(expect.objectContaining({ amount: 100, status: 'success' }), 'alipay_x402');
    expect(response.body).toBe('success');
  });
  it('does not acknowledge when durable enqueue fails', async () => {
    enqueue.mockRejectedValue(new Error('Redis unavailable'));
    expect((await app.inject({ method: 'POST', url: '/webhook/alipay', payload: {} })).statusCode).toBe(500);
  });
  it('rejects malformed JSON payloads', async () => {
    expect((await app.inject({ method: 'POST', url: '/webhook/alipay', payload: [] })).statusCode).toBe(400);
    expect(verify).not.toHaveBeenCalled();
  });
});
