import 'dotenv/config';
import { randomBytes } from 'node:crypto';

// ============================================
// 配置接口定义
// ============================================
export interface AppConfig {
  port: number;
  redis: {
    url: string;
  };
  gatewayBaseUrl: string;
  webhookSecret: string;
  alipay: {
    appId: string;
    privateKey: string;
    publicKey: string;
    gateway: string;
    notifyUrl: string;
    tierServiceIds: Record<string, string>;
  };
  rateLimit: {
    rpm: number;
  };
}

// ============================================
// 环境变量加载和校验
// ============================================
export function loadConfig(): AppConfig {
  const port = parseInt(process.env.PORT || '3000', 10);
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
  const gatewayBaseUrl = process.env.GATEWAY_BASE_URL || `http://localhost:${port}`;
  const webhookSecret = process.env.WEBHOOK_SECRET || randomBytes(32).toString('hex');

  const alipayAppId = process.env.ALIPAY_APP_ID || '';
  const alipayPrivateKey = process.env.ALIPAY_PRIVATE_KEY || '';
  const alipayPublicKey = process.env.ALIPAY_PUBLIC_KEY || '';
  const alipayGateway = process.env.ALIPAY_GATEWAY || 'https://openapi.alipaydev.com/gateway.do';

  // 从 env 加载 tier service ID mapping: ALIPAY_TIER_tier_050=svc_xxx
  const tierServiceIds: Record<string, string> = {};
  for (const [k, v] of Object.entries(process.env)) {
    if (k.startsWith('ALIPAY_TIER_') && v) {
      const tierId = k.replace('ALIPAY_TIER_', '').toLowerCase();
      tierServiceIds[tierId] = v;
    }
  }

  const rpm = parseInt(process.env.RATE_LIMIT_RPM || '100', 10);

  const config: AppConfig = {
    port,
    redis: { url: redisUrl },
    gatewayBaseUrl,
    webhookSecret,
    alipay: {
      appId: alipayAppId,
      privateKey: alipayPrivateKey,
      publicKey: alipayPublicKey,
      gateway: alipayGateway,
      notifyUrl: `${gatewayBaseUrl}/webhook/alipay`,
      tierServiceIds,
    },
    rateLimit: { rpm },
  };

  // 启动时校验关键配置
  validateConfig(config);

  return config;
}

function validateConfig(config: AppConfig): void {
  const warnings: string[] = [];

  if (!config.alipay.appId) {
    warnings.push('ALIPAY_APP_ID not set - Alipay payment disabled');
  }
  if (!config.alipay.privateKey) {
    warnings.push('ALIPAY_PRIVATE_KEY not set - Alipay signing disabled');
  }
  if (!config.alipay.publicKey) {
    warnings.push('ALIPAY_PUBLIC_KEY not set - Alipay verification disabled');
  }

  for (const w of warnings) {
    console.warn(w);
  }
}

// 单例配置实例
let _config: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (!_config) {
    _config = loadConfig();
  }
  return _config;
}
