import { DateTime } from 'luxon';

export const KST_ZONE = 'Asia/Seoul';
export const DATE_KEY_FORMAT = 'yyyy-LL-dd';
export const TIME_KEY_FORMAT = 'HH:mm:ss';

const DATE_KEY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_KEY_REGEX = /^([01]\d|2[0-3]):[0-5]\d:[0-5]\d$/;

export type DatePreset = 'today' | '1w' | '1m' | '3m';

export function nowKst(): DateTime {
  return DateTime.now().setZone(KST_ZONE);
}

export function getTodayDateKey(): string {
  return nowKst().toFormat(DATE_KEY_FORMAT);
}

export function getNowTimeKeyKst(): string {
  return nowKst().toFormat(TIME_KEY_FORMAT);
}

export function parseDateKeyKst(dateKey: string): DateTime {
  if (!DATE_KEY_REGEX.test(dateKey)) {
    throw new Error(`Invalid dateKey format: ${dateKey}`);
  }

  const parsed = DateTime.fromFormat(dateKey, DATE_KEY_FORMAT, {
    zone: KST_ZONE,
    locale: 'ko-KR'
  }).startOf('day');

  if (!parsed.isValid) {
    throw new Error(`Invalid dateKey value: ${dateKey}`);
  }

  return parsed;
}

export function ensureDateKey(dateKey: string): string {
  parseDateKeyKst(dateKey);
  return dateKey;
}

export function ensureTimeKey(timeKey: string): string {
  if (!TIME_KEY_REGEX.test(timeKey)) {
    throw new Error(`Invalid registeredTimeKST format: ${timeKey}`);
  }

  return timeKey;
}

export function toDateKeyKst(value: Date | string | DateTime): string {
  if (value instanceof DateTime) {
    return value.setZone(KST_ZONE).toFormat(DATE_KEY_FORMAT);
  }

  if (value instanceof Date) {
    return DateTime.fromJSDate(value).setZone(KST_ZONE).toFormat(DATE_KEY_FORMAT);
  }

  return DateTime.fromISO(value, { zone: KST_ZONE }).toFormat(DATE_KEY_FORMAT);
}

export function getDateRangeByPreset(
  preset: DatePreset,
  baseDate: DateTime = nowKst()
): { startKey: string; endKey: string } {
  const end = baseDate.startOf('day');

  switch (preset) {
    case 'today':
      return {
        startKey: end.toFormat(DATE_KEY_FORMAT),
        endKey: end.toFormat(DATE_KEY_FORMAT)
      };
    case '1w': {
      const start = end.minus({ days: 6 });
      return {
        startKey: start.toFormat(DATE_KEY_FORMAT),
        endKey: end.toFormat(DATE_KEY_FORMAT)
      };
    }
    case '1m': {
      const start = end.minus({ months: 1 }).plus({ days: 1 });
      return {
        startKey: start.toFormat(DATE_KEY_FORMAT),
        endKey: end.toFormat(DATE_KEY_FORMAT)
      };
    }
    case '3m': {
      const start = end.minus({ months: 3 }).plus({ days: 1 });
      return {
        startKey: start.toFormat(DATE_KEY_FORMAT),
        endKey: end.toFormat(DATE_KEY_FORMAT)
      };
    }
    default:
      return {
        startKey: end.toFormat(DATE_KEY_FORMAT),
        endKey: end.toFormat(DATE_KEY_FORMAT)
      };
  }
}

export function getCurrentMonthDateRange(baseDate: DateTime = nowKst()): {
  startKey: string;
  endKey: string;
} {
  const start = baseDate.startOf('month');
  const end = baseDate.endOf('month');

  return {
    startKey: start.toFormat(DATE_KEY_FORMAT),
    endKey: end.toFormat(DATE_KEY_FORMAT)
  };
}

export function normalizeDateRange(
  startKey?: string,
  endKey?: string
): { startKey: string; endKey: string } | undefined {
  if (!startKey && !endKey) {
    return undefined;
  }

  const start = startKey ?? endKey;
  const end = endKey ?? startKey;

  if (!start || !end) {
    return undefined;
  }

  ensureDateKey(start);
  ensureDateKey(end);

  if (start > end) {
    throw new Error('startKey must be less than or equal to endKey');
  }

  return { startKey: start, endKey: end };
}
