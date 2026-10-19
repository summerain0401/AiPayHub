import { createHash } from 'node:crypto';
import { buildUpstreamUrl } from './proxy.js';

export interface RequestOperation {
  method: string;
  url: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

/** Shared by forwarding and fingerprinting so their header policies cannot drift. */
export function filterUpstreamHeaders(headers: RequestOperation['headers']): Record<string, string> {
  const skip = new Set([
    'host', 'connection', 'x-order-id', 'x-request-id', 'admin-secret-key',
    'content-length', 'transfer-encoding', 'keep-alive', 'proxy-authenticate',
    'proxy-authorization', 'te', 'trailer', 'upgrade',
  ]);
  const connection = headers.connection;
  if (typeof connection === 'string') {
    for (const name of connection.split(',')) skip.add(name.trim().toLowerCase());
  }
  const result: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    const key = name.toLowerCase();
    if (!skip.has(key) && typeof value === 'string') result[key] = value;
  }
  return result;
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

/** Store a digest only; method, destination, forwarded headers and body define one operation. */
export function requestFingerprint(request: RequestOperation, targetUrl: string): string {
  const kind = request.body === undefined ? 'absent' : Buffer.isBuffer(request.body) ? 'buffer' : typeof request.body;
  const operation = {
    version: 1,
    method: request.method.toUpperCase(),
    upstreamUrl: new URL(buildUpstreamUrl(targetUrl, request.url)).href,
    headers: filterUpstreamHeaders(request.headers),
    bodyKind: kind,
    body: Buffer.isBuffer(request.body) ? request.body.toString('base64') : request.body,
  };
  return createHash('sha256').update(canonicalJson(operation)).digest('hex');
}
