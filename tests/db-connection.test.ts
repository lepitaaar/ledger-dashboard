import { beforeEach, describe, expect, it, vi } from 'vitest';

const mongooseMocks = vi.hoisted(() => ({
  connect: vi.fn()
}));

vi.mock('mongoose', () => ({
  default: {
    connect: mongooseMocks.connect
  }
}));

describe('connectMongo', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    delete (globalThis as typeof globalThis & { mongooseCache?: unknown }).mongooseCache;
    process.env.MONGODB_URI = 'mongodb://example.test/ledger';
  });

  it('clears a rejected cached promise so the next request can reconnect', async () => {
    const recoveredConnection = { connection: { readyState: 1 } };
    mongooseMocks.connect
      .mockRejectedValueOnce(new Error('temporary connection failure'))
      .mockResolvedValueOnce(recoveredConnection);

    const { connectMongo } = await import('@/lib/db');

    await expect(connectMongo()).rejects.toThrow('temporary connection failure');
    await expect(connectMongo()).resolves.toBe(recoveredConnection);
    expect(mongooseMocks.connect).toHaveBeenCalledTimes(2);
  });
});
