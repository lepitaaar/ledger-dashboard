import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { handleApiError, HttpError } from '@/lib/http';

describe('handleApiError', () => {
  it('returns a structured validation error with a request id', async () => {
    const error = z.object({ name: z.string().min(1) }).safeParse({ name: '' }).error;
    const response = handleApiError(error);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(response.headers.get('X-Request-Id')).toBe(payload.error.requestId);
    expect(payload.error.code).toBe('VALIDATION_ERROR');
    expect(payload.error.issues.fieldErrors.name).toBeDefined();
  });

  it('preserves an explicit HTTP status and error code', async () => {
    const response = handleApiError(new HttpError(404, '찾을 수 없습니다.', 'NOT_FOUND'));
    const payload = await response.json();

    expect(response.status).toBe(404);
    expect(payload.error.code).toBe('NOT_FOUND');
  });

  it('maps duplicate keys to conflict instead of an internal error', async () => {
    const response = handleApiError({ code: 11000 });
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error.code).toBe('DUPLICATE_KEY');
  });
});
