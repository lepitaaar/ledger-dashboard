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

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const isIdempotentWrite = supportsIdempotency(url, method);
  const headers = new Headers(init?.headers);

  if (init?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (isIdempotentWrite && !headers.has('Idempotency-Key')) {
    headers.set('Idempotency-Key', crypto.randomUUID());
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
