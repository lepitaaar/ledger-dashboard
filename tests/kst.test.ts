import { describe, expect, it } from 'vitest';

import { ensureDateKey, getDateRangeByPreset, normalizeDateRange, parseDateKeyKst } from '@/lib/kst';

describe('KST date utils', () => {
  it('validates dateKey format as YYYY-MM-DD', () => {
    expect(ensureDateKey('2026-02-12')).toBe('2026-02-12');
    expect(() => ensureDateKey('2026/02/12')).toThrow();
  });

  it('builds date ranges with start <= end', () => {
    const range = getDateRangeByPreset('1w');
    expect(range.startKey <= range.endKey).toBe(true);

    const normalized = normalizeDateRange(range.startKey, range.endKey);
    expect(normalized?.startKey).toBe(range.startKey);
    expect(() => normalizeDateRange('2026-02-12', '2026-02-01')).toThrow();

    const parsed = parseDateKeyKst('2026-02-12');
    expect(parsed.isValid).toBe(true);
  });
});
