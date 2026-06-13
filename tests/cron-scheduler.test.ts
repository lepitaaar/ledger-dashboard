import { describe, expect, it, vi } from 'vitest';

const { createScheduler, previousMonthStart } = require('../scripts/cron-scheduler.js') as {
  createScheduler: (options: {
    triggerSync: (startDateKey: string, endDateKey: string) => Promise<boolean>;
    retryIntervalMs: number;
  }) => (now: Date) => Promise<void>;
  previousMonthStart: (year: string, month: string) => string;
};

describe('cron scheduler', () => {
  it('marks a day complete only after a successful response and retries failures', async () => {
    const triggerSync = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const tick = createScheduler({ triggerSync, retryIntervalMs: 5 * 60 * 1000 });

    await tick(new Date('2026-06-12T21:00:00.000Z'));
    await tick(new Date('2026-06-12T21:01:00.000Z'));
    await tick(new Date('2026-06-12T21:05:00.000Z'));
    await tick(new Date('2026-06-12T21:06:00.000Z'));

    expect(triggerSync).toHaveBeenCalledTimes(2);
    expect(triggerSync).toHaveBeenLastCalledWith('2026-06-13', '2026-06-13');
  });

  it('uses the previous month start on the first day of a month', () => {
    expect(previousMonthStart('2026', '01')).toBe('2025-12-01');
  });
});
