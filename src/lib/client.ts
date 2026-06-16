const DEFAULT_TIMEOUT_MS = Number(process.env.NEXT_PUBLIC_REQUEST_TIMEOUT_MS || 15_000);

type ApiErrorPayload = {
  message?: string;
  issues?: unknown;
  error?: {
    code?: string;
    message?: string;
    requestId?: string;
    issues?: unknown;
  };
};

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
    public requestId?: string,
    public issues?: unknown
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

function supportsIdempotency(url: string, method: string): boolean {
  if (method !== 'POST') return false;

  return (
    url === '/api/transactions' ||
    url === '/api/settlements' ||
    url === '/api/settlements/manage' ||
    url === '/api/settlements/manage/return' ||
    url === '/api/settlements/manage/bulk' ||
    /^\/api\/vendors\/[^/]+\/payments$/.test(url)
  );
}

function createIdempotencyKey(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }

  const bytes = new Uint8Array(16);

  if (typeof globalThis.crypto?.getRandomValues === 'function') {
    globalThis.crypto.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index++) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0'));

  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join('')
  ].join('-');
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const isIdempotentWrite = supportsIdempotency(url, method);
  const headers = new Headers(init?.headers);

  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (isIdempotentWrite && !headers.has('Idempotency-Key')) {
    headers.set('Idempotency-Key', createIdempotencyKey());
  }

  const attempts = isIdempotentWrite ? 2 : 1;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    const timeoutSignal = AbortSignal.timeout(DEFAULT_TIMEOUT_MS);
    const signal = init?.signal
      ? AbortSignal.any([init.signal, timeoutSignal])
      : timeoutSignal;
    let response: Response;

    try {
      response = await fetch(url, {
        ...init,
        signal,
        headers
      });
    } catch (error) {
      if (init?.signal?.aborted) throw error;
      if (attempt < attempts) continue;
      if (timeoutSignal.aborted) {
        throw new ApiClientError('요청 시간이 초과되었습니다.', 0, 'REQUEST_TIMEOUT');
      }
      throw error;
    }

    const payload = (await response.json().catch(() => null)) as ApiErrorPayload | null;

    if (!response.ok) {
      throw new ApiClientError(
        payload?.error?.message ?? payload?.message ?? '요청 실패',
        response.status,
        payload?.error?.code ?? 'REQUEST_FAILED',
        payload?.error?.requestId ?? response.headers.get('X-Request-Id') ?? undefined,
        payload?.error?.issues ?? payload?.issues
      );
    }

    return payload as T;
  }

  throw new ApiClientError('요청에 실패했습니다.', 0, 'REQUEST_FAILED');
}

export function buildQueryString(params: Record<string, string | number | undefined | null>): string {
  const query = new URLSearchParams();

  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    query.set(key, String(value));
  }

  return query.toString();
}
