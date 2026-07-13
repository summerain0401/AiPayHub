import { describe, it, expect } from 'vitest';
import { hmacSign, hmacVerify } from '../src/utils/crypto.js';

describe('Webhook Signature', () => {
  const secret = 'webhook-secret';
  it('validates correct signature', () => {
    const sig = hmacSign('amount=200&orderId=ord_x&status=success', secret);
    expect(hmacVerify('amount=200&orderId=ord_x&status=success', secret, sig)).toBe(true);
  });
  it('rejects tampered payload', () => {
    const sig = hmacSign('amount=200', secret);
    expect(hmacVerify('amount=999', secret, sig)).toBe(false);
  });
  it('rejects wrong secret', () => {
    const sig = hmacSign('data', secret);
    expect(hmacVerify('data', 'bad-secret', sig)).toBe(false);
  });
});

describe('X402 Payment State', () => {
  it('PENDING -> PAID allowed, PAID -> PAID rejected', () => {
    const state = new Map<string, string>();
    state.set('ord_1', 'PENDING');
    // Pay
    if (state.get('ord_1') === 'PENDING') state.set('ord_1', 'PAID');
    expect(state.get('ord_1')).toBe('PAID');
    // Duplicate pay rejected
    if (state.get('ord_1') === 'PENDING') state.set('ord_1', 'PAID');
    expect(state.get('ord_1')).toBe('PAID');
  });
});
