import { describe, it, expect } from 'vitest';
import { generateGatewayId, generateAdminKey, generateRequestId, generateOrderId } from '../src/utils/idgen.js';
import { sha256Hash, generateSalt, hmacSign, hmacVerify } from '../src/utils/crypto.js';

describe('ID Generation', () => {
  it('generates gateway IDs with gw_ prefix', () => {
    expect(generateGatewayId()).toMatch(/^gw_[A-Za-z0-9_-]{24}$/);
  });
  it('generates admin keys with ask_ prefix', () => {
    expect(generateAdminKey()).toMatch(/^ask_[A-Za-z0-9_-]{32}$/);
  });
  it('generates unique IDs', () => {
    const ids = new Set(Array.from({ length: 100 }, () => generateGatewayId()));
    expect(ids.size).toBe(100);
  });
  it('generates request IDs', () => {
    expect(generateRequestId()).toMatch(/^req_[A-Za-z0-9_-]{12}$/);
  });
  it('generates order IDs', () => {
    expect(generateOrderId()).toMatch(/^ord_[A-Za-z0-9_-]{16}$/);
  });
});

describe('Crypto Utilities', () => {
  it('sha256 hash with salt verifies correctly', () => {
    const key = 'my-secret-key-123';
    const salt = generateSalt();
    const hash = sha256Hash(key, salt);
    expect(sha256Hash(key, salt)).toBe(hash);
    expect(sha256Hash('wrong-key', salt)).not.toBe(hash);
  });

  it('HMAC signs and verifies', () => {
    const sig = hmacSign('test-data', 'secret');
    expect(hmacVerify('test-data', 'secret', sig)).toBe(true);
    expect(hmacVerify('tampered', 'secret', sig)).toBe(false);
    expect(hmacVerify('test-data', 'wrong-secret', sig)).toBe(false);
  });

  it('HMAC is deterministic', () => {
    expect(hmacSign('x', 'k')).toBe(hmacSign('x', 'k'));
  });
});
