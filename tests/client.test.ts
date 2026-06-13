import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiClientError, fetchJson } from '@/lib/client';

describe('fetchJson', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('retries supported POST requests with the same idempotency key', async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError('network error'))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ok: true } }), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(fetchJson('/api/transactions', {
      method: 'POST',
      body: JSON.stringify({ value: 1 })
    })).resolves.toEqual({ data: { ok: true } });

    const firstHeaders = fetchMock.mock.calls[0][1].headers as Headers;
    const secondHeaders = fetchMock.mock.calls[1][1].headers as Headers;
    expect(firstHeaders.get('Idempotency-Key')).toBeTruthy();
    expect(secondHeaders.get('Idempotency-Key')).toBe(firstHeaders.get('Idempotency-Key'));
  });

  it('preserves structured API error details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: {
        code: 'VALIDATION_ERROR',
        message: '입력값 검증에 실패했습니다.',
        requestId: 'request-1',
        issues: { fieldErrors: { name: ['필수입니다.'] } }
      }
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    })));

    const error = await fetchJson('/api/vendors').catch((caught) => caught);
    expect(error).toBeInstanceOf(ApiClientError);
    expect(error).toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      requestId: 'request-1'
    });
  });
});
