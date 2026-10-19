import { describe, it, expect, vi } from 'vitest';
import { generateKeyPairSync, sign } from 'node:crypto';
import { AlipayX402Provider, parseCnyCents } from '../src/services/payment.js';

// Ephemeral test keys; no network calls or live credentials.
const keys = vi.hoisted(() => ({ config: {} as Record<string, unknown> }));
vi.mock('../src/config.js', () => ({ getConfig: () => keys.config }));
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});
keys.config = { gatewayBaseUrl: 'http://localhost:3000', alipay: {
  appId: 'test-app', privateKey, publicKey, gateway: 'https://openapi.alipaydev.com/gateway.do',
  notifyUrl: 'http://localhost:3000/webhook/alipay',
} };
const provider = new AlipayX402Provider();

function notification(overrides: Record<string, string> = {}) {
  const fields = { app_id: 'test-app', out_trade_no: 'order-test', trade_no: 'trade-test',
    total_amount: '1.00', trade_status: 'TRADE_SUCCESS', ...overrides };
  const text = Object.keys(fields).sort().map((key) => `${key}=${fields[key as keyof typeof fields]}`).join('&');
  return { ...fields, sign_type: 'RSA2', sign: sign('RSA-SHA256', Buffer.from(text), privateKey).toString('base64') };
}

describe('Actual Alipay SDK adapter', () => {
  it('verifies RSA2 and converts decimal yuan to integer cents', async () => {
    expect(await provider.verifyWebhook(notification())).toMatchObject({ valid: true, amount: 100, status: 'success' });
  });
  it('rejects tampering and a signed notification for another application', async () => {
    expect((await provider.verifyWebhook({ ...notification(), total_amount: '2.00' })).valid).toBe(false);
    expect((await provider.verifyWebhook(notification({ app_id: 'other-app' }))).valid).toBe(false);
  });
  it('does not classify unpaid/closed notifications as successful', async () => {
    for (const trade_status of ['WAIT_BUYER_PAY', 'TRADE_CLOSED']) {
      expect((await provider.verifyWebhook(notification({ trade_status }))).status).toBe('fail');
    }
  });
  it('builds a signed WAP checkout URL without contacting the provider', async () => {
    const result = await provider.createPayment({ orderId: 'order-test', gatewayId: 'gateway-test',
      amount: 100, subject: 'test', method: 'alipay' });
    expect(result.errorMessage).toBeUndefined();
    expect(result.success).toBe(true);
    const url = new URL(result.x402Url!);
    expect(url.searchParams.get('method')).toBe('alipay.trade.wap.pay');
    expect(JSON.parse(url.searchParams.get('biz_content')!).total_amount).toBe('1.00');
    expect(url.searchParams.get('sign')).toBeTruthy();
  });
});

describe('Decimal payment amount parsing', () => {
  it.each([['0.01', 1], ['1', 100], ['1.5', 150], ['19.99', 1999]])('parses %s', (value, cents) => {
    expect(parseCnyCents(value as string)).toBe(cents);
  });
  it.each(['', '0', '-1', 'NaN', '1e2', '1.001', '9999999999999999999'])('rejects %s', (value) => {
    expect(parseCnyCents(value)).toBeNull();
  });
});
