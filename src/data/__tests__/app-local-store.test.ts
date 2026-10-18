const mockDb = { name: 'db' };
jest.mock('@/data/local-db', () => ({ openLocalDb: jest.fn(async () => mockDb) }));
jest.mock('@/data/local-store', () => ({ createLocalStore: jest.fn((db: unknown) => ({ store: db })) }));

/* eslint-disable @typescript-eslint/no-require-imports */
const load = () => require('@/data/app-local-store') as typeof import('@/data/app-local-store');
const opened = () => (require('@/data/local-db') as typeof import('@/data/local-db')).openLocalDb;
/* eslint-enable @typescript-eslint/no-require-imports */

// The store is a module-level singleton: every test starts with a fresh module.
beforeEach(() => jest.resetModules());

describe('appLocalStore', () => {
  it('is the SQLite store of the device, opened once for the whole app', async () => {
    const first = load().appLocalStore();
    const second = load().appLocalStore();

    expect(second).toBe(first);
    await expect(first).resolves.toEqual({ store: mockDb });
    expect(opened()).toHaveBeenCalledTimes(1);
  });

  it('does not keep a failed open: the next call opens again (a locked or full disk can recover)', async () => {
    jest.mocked(opened()).mockRejectedValueOnce(new Error('database is locked'));

    const failed = load().appLocalStore();
    await expect(failed).rejects.toThrow('database is locked');

    const retried = load().appLocalStore();
    expect(retried).not.toBe(failed);
    await expect(retried).resolves.toEqual({ store: mockDb });
    expect(load().appLocalStore()).toBe(retried);
    expect(opened()).toHaveBeenCalledTimes(2);
  });
});
