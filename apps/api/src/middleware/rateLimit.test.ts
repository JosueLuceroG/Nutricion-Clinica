import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { rateLimit } from './rateLimit.js';

function makeRequest(options: { ip: string; forwarded?: string; trustProxy?: boolean }): Request {
  return {
    app: { get: vi.fn((key: string) => (key === 'trust proxy' ? Boolean(options.trustProxy) : undefined)) },
    header: vi.fn((key: string) => (key.toLowerCase() === 'x-forwarded-for' ? options.forwarded : undefined)),
    ip: options.ip,
    socket: { remoteAddress: options.ip },
  } as unknown as Request;
}

function makeResponse(): Response {
  return {
    setHeader: vi.fn(),
    status: vi.fn().mockReturnThis(),
    json: vi.fn(),
  } as unknown as Response;
}

describe('rateLimit', () => {
  it('does not trust x-forwarded-for unless trust proxy is enabled', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 1, keyPrefix: 'no-proxy-test' });
    const next = vi.fn();

    limiter(makeRequest({ ip: '10.0.0.1', forwarded: '203.0.113.1' }), makeResponse(), next);
    limiter(makeRequest({ ip: '10.0.0.2', forwarded: '203.0.113.1' }), makeResponse(), next);

    expect(next).toHaveBeenCalledTimes(2);
  });

  it('uses x-forwarded-for when trust proxy is enabled', () => {
    const limiter = rateLimit({ windowMs: 60_000, max: 1, keyPrefix: 'proxy-test' });
    const next = vi.fn();
    const secondResponse = makeResponse();

    limiter(makeRequest({ ip: '10.0.0.1', forwarded: '203.0.113.1', trustProxy: true }), makeResponse(), next);
    limiter(makeRequest({ ip: '10.0.0.2', forwarded: '203.0.113.1', trustProxy: true }), secondResponse, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(secondResponse.status).toHaveBeenCalledWith(429);
  });
});
