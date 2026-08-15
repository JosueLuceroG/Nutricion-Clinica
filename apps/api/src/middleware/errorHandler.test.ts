import { describe, expect, it, vi } from 'vitest';
import type { Request, Response } from 'express';
import { errorHandler, HttpError } from './errorHandler.js';

describe('errorHandler HttpError details', () => {
  it('returns safe structured details supplied by a domain policy error', () => {
    const res = {
      status: vi.fn(),
      json: vi.fn(),
    };
    res.status.mockReturnValue(res);

    errorHandler(new HttpError(403, 'Forbidden', [{ index: 1, code: 'unauthorized' }]), {} as Request, res as unknown as Response, vi.fn());

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Forbidden',
      details: [{ index: 1, code: 'unauthorized' }],
    });
  });
});
