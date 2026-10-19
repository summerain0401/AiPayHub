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
  it('preserves double slashes and URL-shaped query parameters', () => {
    expect(buildUpstreamUrl('https://api.example.com/v1', '/gw_test//items?next=https://example.com/a//b'))
      .toBe('https://api.example.com/v1//items?next=https://example.com/a//b');
  });
  it('handles a query-only suffix without using slashes inside the query as path separators', () => {
    expect(buildUpstreamUrl('https://api.example.com', '/gw_test?next=https://example.com'))
      .toBe('https://api.example.com/?next=https://example.com');
  });
});
