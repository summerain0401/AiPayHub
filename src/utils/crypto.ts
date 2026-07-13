import { randomBytes, createHmac, createHash, timingSafeEqual } from 'node:crypto';

// ============================================
// 加密与签名工具集
// ============================================

/** HMAC-SHA256 签名 */
export function hmacSign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

/** HMAC-SHA256 验签 (常量时间比较防止时序攻击) */
export function hmacVerify(payload: string, secret: string, signature: string): boolean {
  const expected = hmacSign(payload, secret);
  try {
    return timingSafeEqual(
      Buffer.from(expected, 'hex'),
      Buffer.from(signature, 'hex')
    );
  } catch {
    return false;
  }
}

/** SHA-256 哈希 (用于 Admin Key 存储) */
export function sha256Hash(value: string, salt?: string): string {
  const input = salt ? `${value}:${salt}` : value;
  return createHash('sha256').update(input).digest('hex');
}

/** 生成随机密钥 (hex 格式) */
export function generateSecret(bytes = 32): string {
  return randomBytes(bytes).toString('hex');
}

/** 生成随机盐值 */
export function generateSalt(bytes = 16): string {
  return randomBytes(bytes).toString('hex');
}
