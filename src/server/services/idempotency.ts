import type { ClientSession } from 'mongoose';
import type { NextRequest } from 'next/server';

import { withMongoTransaction } from '@/lib/db';
import { HttpError } from '@/lib/http';
import { safeJson } from '@/lib/utils';
import {
  type IdempotencyRecord,
  IdempotencyRecordModel
} from '@/server/models/idempotency-record';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function isDuplicateKeyError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 11000;
}

async function findCompleted<T>(scope: string, key: string): Promise<T | null> {
  const record = await IdempotencyRecordModel.findOne({
    scope,
    key,
    status: 'completed'
  }).lean<IdempotencyRecord | null>();

  return record ? record.response as T : null;
}

export async function runIdempotentMongoTransaction<T>(
  request: NextRequest,
  scope: string,
  operation: (session: ClientSession) => Promise<T>
): Promise<{ value: T; replayed: boolean }> {
  const key = request.headers.get('Idempotency-Key');

  if (!key) {
    return {
      value: await withMongoTransaction(operation),
      replayed: false
    };
  }

  if (key.length < 8 || key.length > 200) {
    throw new HttpError(400, 'Idempotency-Key 형식이 올바르지 않습니다.', 'INVALID_IDEMPOTENCY_KEY');
  }

  const completed = await findCompleted<T>(scope, key);
  if (completed !== null) {
    return { value: completed, replayed: true };
  }

  try {
    const value = await withMongoTransaction(async (session) => {
      const [record] = await IdempotencyRecordModel.create([{
        scope,
        key,
        status: 'processing',
        response: null,
        expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS)
      }], { session });

      const result = safeJson(await operation(session));
      record.status = 'completed';
      record.response = result;
      await record.save({ session });
      return result;
    });

    return { value, replayed: false };
  } catch (error) {
    if (!isDuplicateKeyError(error)) throw error;

    for (let attempt = 0; attempt < 5; attempt++) {
      const replay = await findCompleted<T>(scope, key);
      if (replay !== null) return { value: replay, replayed: true };
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    throw new HttpError(
      409,
      '같은 요청이 처리 중입니다. 잠시 후 다시 시도해 주세요.',
      'IDEMPOTENCY_IN_PROGRESS'
    );
  }
}
