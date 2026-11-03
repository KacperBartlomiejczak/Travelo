import { AuthRetryableFetchError } from '@supabase/supabase-js';

import { migrateLocalDb } from '@/data/local-db';
import { createExpenseRepository, type ExpenseScope } from '@/data/expense-repository';
import { createExpenseSync } from '@/data/expense-sync';
import { createLocalStore } from '@/data/local-store';
import type { TripListItem } from '@/schemas';
import { fakeSupabase, NETWORK_FAILURE } from '@/test/fake-supabase';
import { openTestDb } from '@/test/node-sqlite';

const TRIP_ID = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01';
const OTHER_TRIP_ID = '1c0f8d5f-7b54-4d5c-8b66-3a7f1f8f2b02';
const FRIEND = '4f3c1a8c-0e87-4a8f-9e99-6d0c4c1c5e05';
const THEIRS = '5a4d2b9d-1f98-4b90-8faa-7e1d5d2d6f06';

const owner: ExpenseScope = { tripId: TRIP_ID, baseCurrency: 'EUR', writer: { isOwner: true, ownMemberId: null } };
const input = { name: 'Taxi', amount: { amountMinor: 1500, currency: 'EUR' }, category: 'transport', memberId: null, spentOn: '2026-11-03' } as const;

const listItem = (id: string): TripListItem => ({
  id, name: 'Trip', coverImageUri: 'preset:auckland', destination: 'BCN', flights: [], startDate: '2026-11-02', endDate: '2026-11-09',
});

const serverRow = (over: Record<string, unknown> = {}) => ({
  id: THEIRS, trip_id: TRIP_ID, member_id: FRIEND, name: 'Lunch', amount_minor: 2500, currency: 'EUR', category: 'food',
  spent_on: '2026-11-03', created_at: '2026-11-03T09:00:00+00:00', updated_at: '2026-11-03T09:00:00+00:00', deleted_at: null, ...over,
});

async function setup() {
  const supabase = fakeSupabase();
  const db = openTestDb();
  await migrateLocalDb(db);
  const store = createLocalStore(db);
  let tick = 0;
  let id = 0;
  const clock = { at: new Date('2026-11-03T12:00:00.000Z') };
  const repo = createExpenseRepository({
    db,
    store,
    now: () => new Date(Date.UTC(2026, 10, 3, 10, 0, ++tick)),
    newId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`,
  });
  const corrupt = jest.fn();
  const sync = createExpenseSync({ supabase: supabase.client, db, store, now: () => clock.at, onCorruptRow: corrupt });
  const status = (expenseId: string) =>
    db.getFirstAsync<{ sync_status: string; sync_error: string | null; attempts: number; updated_at: string; deleted_at: string | null }>(
      'select sync_status, sync_error, attempts, updated_at, deleted_at from expenses where id = ?',
      [expenseId],
    );
  return { supabase, db, store, repo, sync, corrupt, clock, status };
}

/** A server that upserts by id and ignores anything not newer, like upsert_expense. */
function fakeServer(supabase: ReturnType<typeof fakeSupabase>) {
  const rows = new Map<string, { updated_at: string }>();
  supabase.rpc.mockImplementation(async (_name, args) => {
    const row = (args as { expense: { id: string; updated_at: string } }).expense;
    const old = rows.get(row.id);
    if (!old || old.updated_at < row.updated_at) rows.set(row.id, row);
    return { data: null, error: null, status: 204 };
  });
  return rows;
}

describe('expense sync: push (expenses D16; Verification loop 8)', () => {
  it('saved offline stays pending (attempt counted), and is synced once the connection is back', async () => {
    const { supabase, repo, sync, status, clock } = await setup();
    const added = await repo.add(owner, input);
    supabase.rpc.mockResolvedValueOnce(NETWORK_FAILURE);

    await sync.sync();
    expect(await status(added.id)).toMatchObject({ sync_status: 'pending', attempts: 1 });

    clock.at = new Date('2026-11-03T12:00:05.000Z');
    await sync.sync();
    expect(await status(added.id)).toMatchObject({ sync_status: 'synced', attempts: 0, sync_error: null });
    expect(supabase.rpc).toHaveBeenLastCalledWith('upsert_expense', {
      expense: {
        id: added.id, trip_id: TRIP_ID, member_id: null, name: 'Taxi', amount_minor: 1500, currency: 'EUR', category: 'transport',
        spent_on: '2026-11-03', created_at: added.createdAt, updated_at: added.updatedAt, deleted_at: null,
      },
    });
  });

  it('retrying the same entry creates no duplicate on the server', async () => {
    const { supabase, db, repo, sync } = await setup();
    const server = fakeServer(supabase);
    const added = await repo.add(owner, input);
    await sync.sync();
    // The response was lost on the way back: the device still thinks it is pending.
    await db.runAsync("update expenses set sync_status = 'pending'", []);
    await sync.sync();

    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect([...server.keys()]).toEqual([added.id]);
  });

  it('a refusal makes it failed and visible, retried only after the backoff (1 s, then 2 s)', async () => {
    const { supabase, repo, sync, status, clock } = await setup();
    const added = await repo.add(owner, input);
    supabase.rpc.mockResolvedValue({ data: null, error: { message: 'new row violates row-level security policy', code: '42501' }, status: 403 });

    const first = await sync.sync();
    expect(await status(added.id)).toMatchObject({ sync_status: 'failed', sync_error: 'new row violates row-level security policy', attempts: 1 });
    expect(first.nextAttemptAt).toEqual(new Date('2026-11-03T12:00:01.000Z'));
    expect((await repo.list(TRIP_ID)).map((e) => [e.id, e.syncStatus])).toEqual([[added.id, 'failed']]);

    clock.at = new Date('2026-11-03T12:00:00.500Z');
    await sync.sync();
    expect(supabase.rpc).toHaveBeenCalledTimes(1);

    clock.at = new Date('2026-11-03T12:00:01.000Z');
    const second = await sync.sync();
    expect(supabase.rpc).toHaveBeenCalledTimes(2);
    expect(await status(added.id)).toMatchObject({ sync_status: 'failed', attempts: 2 });
    expect(second.nextAttemptAt).toEqual(new Date('2026-11-03T12:00:03.000Z'));
  });

  it('a soft delete syncs (deleted_at goes to the server)', async () => {
    const { supabase, repo, sync, status } = await setup();
    const added = await repo.add(owner, input);
    await sync.sync();
    await repo.remove(owner, added.id);
    await sync.sync();

    const sent = supabase.rpc.mock.calls.at(-1)?.[1] as { expense: { deleted_at: string } };
    expect(sent.expense.deleted_at).toEqual(expect.any(String));
    expect(await status(added.id)).toMatchObject({ sync_status: 'synced' });
  });

  it('an edit made while the push is in flight stays pending', async () => {
    const { supabase, repo, sync, status } = await setup();
    const added = await repo.add(owner, input);
    let release: () => void = () => {};
    supabase.rpc.mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve({ data: null, error: null, status: 204 }))));

    const running = sync.sync();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const edited = await repo.update(owner, added.id, { ...input, name: 'Bus' });
    release();
    await running;

    expect(await status(added.id)).toMatchObject({ sync_status: 'pending', updated_at: edited.updatedAt });
  });

  it('two triggers at once send the entry once', async () => {
    const { supabase, repo, sync } = await setup();
    await repo.add(owner, input);
    await Promise.all([sync.sync(), sync.sync()]);
    expect(supabase.rpc).toHaveBeenCalledTimes(1);
  });

  it('sends nothing when nobody is signed in, and counts no attempt', async () => {
    const { supabase, repo, sync, status } = await setup();
    const added = await repo.add(owner, input);
    supabase.storedSession('none');
    await sync.sync();
    expect(supabase.rpc).not.toHaveBeenCalled();
    expect(await status(added.id)).toMatchObject({ sync_status: 'pending', attempts: 0 });
  });

  describe('session unavailable with an elapsed backoff', () => {
    async function elapsedBackoff() {
      const ctx = await setup();
      const added = await ctx.repo.add(owner, input);
      ctx.supabase.rpc.mockResolvedValueOnce(NETWORK_FAILURE);
      await ctx.sync.sync();
      ctx.clock.at = new Date('2026-11-03T13:00:00.000Z');
      return { ...ctx, added };
    }

    it('schedules nothing when the session check has no connection, and counts no attempt', async () => {
      const { supabase, sync, status, added } = await elapsedBackoff();
      supabase.auth.getSession.mockResolvedValue({ data: { session: null as never }, error: new AuthRetryableFetchError('offline', 0) });
      expect(await sync.sync()).toEqual({ nextAttemptAt: null });
      expect(await status(added.id)).toMatchObject({ sync_status: 'pending', attempts: 1 });
    });

    it('schedules nothing when nobody is signed in, and counts no attempt', async () => {
      const { supabase, sync, status, added } = await elapsedBackoff();
      supabase.storedSession('none');
      expect(await sync.sync()).toEqual({ nextAttemptAt: null });
      expect(await status(added.id)).toMatchObject({ sync_status: 'pending', attempts: 1 });
    });

    it('still rejects on any other error', async () => {
      const { supabase, sync } = await elapsedBackoff();
      supabase.auth.getSession.mockResolvedValue({ data: { session: null as never }, error: new Error('boom') });
      await expect(sync.sync()).rejects.toThrow('boom');
    });
  });

  it('sends nothing more and writes nothing after the user was cleared during the push', async () => {
    const { supabase, db, repo, sync, store } = await setup();
    await repo.add(owner, input);
    await repo.add(owner, input);
    let release: () => void = () => {};
    supabase.rpc.mockImplementationOnce(() => new Promise((resolve) => (release = () => resolve({ data: null, error: null, status: 204 }))));
    const running = sync.sync();
    await new Promise((resolve) => setTimeout(resolve, 20));
    const cleared = store.clearUserData();
    release();
    await Promise.all([running, cleared]);

    expect(supabase.rpc).toHaveBeenCalledTimes(1);
    expect(await db.getAllAsync('select id from expenses', [])).toEqual([]);
  });
});

describe('expense sync: pull', () => {
  it('brings the expenses of others from the server as synced, with normalized timestamps', async () => {
    const { supabase, repo, sync, store } = await setup();
    await store.cacheList([listItem(TRIP_ID)], '2026-11-03T09:00:00.000Z');
    supabase.respond('expenses', { data: [serverRow()] });

    await sync.sync();

    expect(supabase.queries.find((q) => q.table === 'expenses')?.ops).toEqual([['select', ['*']], ['eq', ['trip_id', TRIP_ID]]]);
    expect(await repo.list(TRIP_ID)).toEqual([
      expect.objectContaining({ id: THEIRS, memberId: FRIEND, syncStatus: 'synced', createdAt: '2026-11-03T09:00:00.000Z', updatedAt: '2026-11-03T09:00:00.000Z' }),
    ]);
  });

  it('a newer server row wins over a synced local one, an older one does not', async () => {
    const { supabase, repo, sync, store } = await setup();
    await store.cacheList([listItem(TRIP_ID)], '2026-11-03T09:00:00.000Z');
    supabase.respond('expenses', { data: [serverRow()] });
    await sync.sync();

    supabase.respond('expenses', { data: [serverRow({ name: 'Old', updated_at: '2026-11-03T08:00:00+00:00' })] });
    await sync.sync();
    expect((await repo.list(TRIP_ID))[0].name).toBe('Lunch');

    supabase.respond('expenses', { data: [serverRow({ name: 'Dinner', updated_at: '2026-11-03T09:30:00+00:00' })] });
    await sync.sync();
    expect((await repo.list(TRIP_ID))[0]).toMatchObject({ name: 'Dinner', updatedAt: '2026-11-03T09:30:00.000Z' });
  });

  it('a soft-deleted server row leaves the list', async () => {
    const { supabase, repo, sync, store } = await setup();
    await store.cacheList([listItem(TRIP_ID)], '2026-11-03T09:00:00.000Z');
    supabase.respond('expenses', { data: [serverRow()] });
    await sync.sync();
    supabase.respond('expenses', { data: [serverRow({ updated_at: '2026-11-03T10:00:00+00:00', deleted_at: '2026-11-03T10:00:00+00:00' })] });
    await sync.sync();
    expect(await repo.list(TRIP_ID)).toEqual([]);
  });

  it('never overwrites a local pending or failed row, even with a newer server row', async () => {
    const { supabase, db, repo, sync, store, status } = await setup();
    await store.cacheList([listItem(TRIP_ID)], '2026-11-03T09:00:00.000Z');
    const pending = await repo.add(owner, input);
    const failed = await repo.add(owner, { ...input, name: 'Bus' });
    await db.runAsync("update expenses set sync_status = 'failed', attempts = 1, last_attempt_at = '2026-11-03T12:00:00.000Z' where id = ?", [failed.id]);
    supabase.rpc.mockResolvedValue(NETWORK_FAILURE);
    supabase.respond('expenses', {
      data: [serverRow({ id: pending.id, name: 'Server', updated_at: '2026-12-01T00:00:00+00:00' }), serverRow({ id: failed.id, name: 'Server', updated_at: '2026-12-01T00:00:00+00:00' })],
    });

    await sync.sync();

    expect((await repo.list(TRIP_ID)).map((e) => e.name).sort()).toEqual(['Bus', 'Taxi']);
    expect((await status(pending.id))?.sync_status).toBe('pending');
    expect((await status(failed.id))?.sync_status).toBe('failed');
  });

  it('skips a corrupt server row and reports it, keeping the others', async () => {
    const { supabase, repo, sync, store, corrupt } = await setup();
    await store.cacheList([listItem(TRIP_ID)], '2026-11-03T09:00:00.000Z');
    supabase.respond('expenses', { data: [serverRow({ id: '6b5e3c0e-2a09-4ca1-9fbb-8f2e6e3e7a07', category: 'bogus' }), serverRow()] });

    await sync.sync();

    expect((await repo.list(TRIP_ID)).map((e) => e.id)).toEqual([THEIRS]);
    expect(corrupt).toHaveBeenCalledTimes(1);
    expect(corrupt.mock.calls[0][0]).toBe('6b5e3c0e-2a09-4ca1-9fbb-8f2e6e3e7a07');
  });

  it('a failed read of one trip does not stop the others', async () => {
    const { supabase, repo, sync, store } = await setup();
    await store.cacheList([listItem(OTHER_TRIP_ID), listItem(TRIP_ID)], '2026-11-03T09:00:00.000Z');
    supabase.respond('expenses', NETWORK_FAILURE, { data: [serverRow()] });
    await sync.sync();
    expect((await repo.list(TRIP_ID)).map((e) => e.id)).toEqual([THEIRS]);
  });

  it('pulls nothing without a trip list copy', async () => {
    const { supabase, sync } = await setup();
    await sync.sync();
    expect(supabase.queries).toEqual([]);
  });
});
