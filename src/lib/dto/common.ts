import { z } from 'zod';

import { ensureDateKey, ensureTimeKey } from '@/lib/kst';
import { OBJECT_ID_REGEX } from '@/lib/object-id';

export const objectIdSchema = z.string().regex(OBJECT_ID_REGEX, '유효한 ObjectId가 아닙니다.');

export const queryBooleanSchema = z
  .string()
  .optional()
  .transform((value) => {
    if (value === undefined) {
      return undefined;
    }

    return value === 'true' || value === '1';
  });

export const queryNumberSchema = (defaultValue: number) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined || value.trim() === '') {
        return defaultValue;
      }

      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : defaultValue;
    });

export const dateKeySchema = z.string().refine((value) => {
  try {
    ensureDateKey(value);
    return true;
  } catch {
    return false;
  }
}, '유효한 날짜(YYYY-MM-DD, KST)가 아닙니다.');

export const timeKeySchema = z.string().refine((value) => {
  try {
    ensureTimeKey(value);
    return true;
  } catch {
    return false;
  }
}, '유효한 시간(HH:mm:ss, KST)이 아닙니다.');
