import { describe, expect, it } from 'vitest';

import { calculateAmount } from '@/server/services/transactions';

describe('calculateAmount', () => {
  it('recalculates amount from unitPrice * qty', () => {
    expect(calculateAmount(12500, 10)).toBe(125000);
    expect(calculateAmount(22000, -2)).toBe(-44000);
  });

  it('keeps decimal precision up to 2 digits', () => {
    expect(calculateAmount(12.345, 3)).toBe(37.04);
  });
});
