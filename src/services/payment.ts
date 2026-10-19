import { createRequire } from 'node:module';
import { getConfig } from '../config.js';
import type { PaymentProvider, PaymentRequest, PaymentResult, WebhookResult } from '../types/index.js';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AlipaySdk: any = require('alipay-sdk').AlipaySdk;

function getClient() {
  const c = getConfig();
  if (!c.alipay.appId) return null;
  const privateKey = c.alipay.privateKey.replace(/\\n/g, '\n');
  return new AlipaySdk({
    appId: c.alipay.appId,
    privateKey,
    keyType: privateKey.includes('BEGIN PRIVATE KEY') ? 'PKCS8' : 'PKCS1',
    alipayPublicKey: c.alipay.publicKey.replace(/\\n/g, '\n'),
    gateway: c.alipay.gateway,
    signType: 'RSA2',
  });
}

export class AlipayX402Provider implements PaymentProvider {
  name = 'alipay_x402';

  async createPayment(req: PaymentRequest): Promise<PaymentResult> {
    const config = getConfig();
    try {
      const client = getClient();
      if (!client) return { success: false, errorMessage: 'Alipay not configured' };
      const result = client.pageExec('alipay.trade.wap.pay', 'GET', {
        bizContent: {
          outTradeNo: req.orderId,
          totalAmount: (req.amount / 100).toFixed(2),
          subject: req.subject,
          productCode: 'QUICK_WAP_WAY',
        },
        notifyUrl: config.alipay.notifyUrl,
        returnUrl: req.returnUrl || `${config.gatewayBaseUrl}/pay/${req.orderId}/callback`,
      });
      return { success: true, x402Url: typeof result === 'string' ? result : '', tradeNo: req.orderId };
    } catch (err) {
      return { success: false, errorMessage: `Alipay error: ${(err as Error).message}` };
    }
  }

  async verifyWebhook(payload: Record<string, string>): Promise<WebhookResult> {
    let valid = false;
    try { valid = getClient()?.checkNotifySign(payload, true) ?? false; } catch { valid = false; }
    return {
      valid: valid && payload['app_id'] === getConfig().alipay.appId
        && !!payload['out_trade_no'] && !!payload['trade_no']
        && parseCnyCents(payload['total_amount']) !== null,
      orderId: payload['out_trade_no'] || '',
      tradeNo: payload['trade_no'] || '',
      amount: parseCnyCents(payload['total_amount']) ?? 0,
      status: ['TRADE_SUCCESS', 'TRADE_FINISHED'].includes(payload['trade_status']) ? 'success' : 'fail',
    };
  }
}

/** Parse provider decimal yuan without accepting exponents, negatives or fractions of a cent. */
export function parseCnyCents(value: string | undefined): number | null {
  if (!value || !/^\d+(\.\d{1,2})?$/.test(value)) return null;
  const [yuan, fraction = ''] = value.split('.');
  const cents = Number(yuan) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

const providers = new Map<string, PaymentProvider>();

export function registerPaymentProvider(p: PaymentProvider) { providers.set(p.name, p); }
export function getPaymentProvider(name: string) { return providers.get(name); }
export function getDefaultProvider() { return providers.get('alipay_x402'); }
export function initPaymentService() { registerPaymentProvider(new AlipayX402Provider()); }
