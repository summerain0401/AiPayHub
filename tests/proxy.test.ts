import { describe, it, expect } from 'vitest';
import { buildUpstreamUrl } from '../src/services/proxy.js';

describe('buildUpstreamUrl', () => {
  it('strips gatewayId from path', () => {
    expect(buildUpstreamUrl('https://api.example.com', '/gw_abc/some/endpoint'))
      .toBe('https://api.example.com/some/endpoint');
  });
  it('handles Dify-style URLs', () => {
    expect(buildUpstreamUrl('https://api.dify.ai/v1', '/gw_xyz/workflows/run'))
      .toBe('https://api.dify.ai/v1/workflows/run');
  });
  it('handles target with trailing slash', () => {
    expect(buildUpstreamUrl('https://api.example.com/', '/gw_test/api'))
      .toBe('https://api.example.com/api');
  });
  it('handles empty path after gatewayId', () => {
    expect(buildUpstreamUrl('https://api.example.com', '/gw_test'))
      .toBe('https://api.example.com/');
  });
});
