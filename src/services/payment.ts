import { createRequire } from 'node:module';
import { getConfig } from '../config.js';
import type { PaymentProvider, PaymentRequest, PaymentResult, WebhookResult } from '../types/index.js';

const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const AlipaySdk: any = require('alipay-sdk').AlipaySdk;

function getClient() {
  const c = getConfig();
  if (!c.alipay.appId) return null;
  return new AlipaySdk({
    appId: c.alipay.appId,
    privateKey: c.alipay.privateKey,
    alipayPublicKey: c.alipay.publicKey,
    gateway: c.alipay.gateway,
    signType: 'RSA2',
  });
}

export class AlipayX402Provider implements PaymentProvider {
  name = 'alipay_x402';

  async createPayment(req: PaymentRequest): Promise<PaymentResult> {
    const config = getConfig();
    const client = getClient();
    if (!client) return { success: false, errorMessage: 'Alipay not configured' };

    try {
      const result = await client.exec('alipay.trade.wap.pay', {
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
    const client = getClient();
    let valid = false;
    if (client) {
      try { valid = client.checkNotifySign(payload); } catch { valid = false; }
    }
    return {
      valid,
      orderId: payload['out_trade_no'] || '',
      tradeNo: payload['trade_no'] || '',
      amount: Number(payload['total_amount'] || '0'),
      status: payload['trade_status'] === 'TRADE_SUCCESS' ? 'success' : 'fail',
    };
  }
}

const providers = new Map<string, PaymentProvider>();

export function registerPaymentProvider(p: PaymentProvider) { providers.set(p.name, p); }
export function getPaymentProvider(name: string) { return providers.get(name); }
export function getDefaultProvider() { return providers.get('alipay_x402'); }
export function initPaymentService() { registerPaymentProvider(new AlipayX402Provider()); }
