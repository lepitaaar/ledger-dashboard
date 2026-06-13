import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = 'HTTP_ERROR'
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export function parseQueryBoolean(value: string | undefined): boolean | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (value === 'true' || value === '1') {
    return true;
  }

  if (value === 'false' || value === '0') {
    return false;
  }

  return undefined;
}

type ErrorPayload = {
  message: string;
  error: {
    code: string;
    message: string;
    requestId: string;
    issues?: unknown;
  };
};

function errorResponse(
  status: number,
  code: string,
  message: string,
  requestId: string,
  issues?: unknown
): NextResponse {
  const payload: ErrorPayload = {
    message,
    error: {
      code,
      message,
      requestId,
      ...(issues === undefined ? {} : { issues })
    }
  };

  return NextResponse.json(payload, {
    status,
    headers: { 'X-Request-Id': requestId }
  });
}

function isMongoDuplicateKeyError(error: unknown): error is { code: number } {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

function isMongoCastError(error: unknown): error is { name: string } {
  return typeof error === 'object' && error !== null && 'name' in error && error.name === 'CastError';
}

export function handleApiError(error: unknown): NextResponse {
  const requestId = randomUUID();

  if (error instanceof ZodError) {
    return errorResponse(
      400,
      'VALIDATION_ERROR',
      '입력값 검증에 실패했습니다.',
      requestId,
      error.flatten()
    );
  }

  if (error instanceof HttpError) {
    return errorResponse(error.status, error.code, error.message, requestId);
  }

  if (error instanceof SyntaxError) {
    return errorResponse(400, 'INVALID_JSON', '요청 JSON 형식이 올바르지 않습니다.', requestId);
  }

  if (isMongoCastError(error)) {
    return errorResponse(400, 'INVALID_IDENTIFIER', '식별자 형식이 올바르지 않습니다.', requestId);
  }

  if (isMongoDuplicateKeyError(error)) {
    return errorResponse(409, 'DUPLICATE_KEY', '이미 존재하는 데이터입니다.', requestId);
  }

  console.error(JSON.stringify({
    level: 'error',
    requestId,
    code: 'INTERNAL_SERVER_ERROR',
    message: error instanceof Error ? error.message : String(error),
    stack: error instanceof Error ? error.stack : undefined
  }));
  return errorResponse(500, 'INTERNAL_SERVER_ERROR', '서버 오류가 발생했습니다.', requestId);
}
