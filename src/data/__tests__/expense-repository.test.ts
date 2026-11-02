import { migrateLocalDb } from '@/data/local-db';
import {
  CurrencyMismatchError,
  ExpenseNotFoundError,
  ExpenseWriteDroppedError,
  NotYourExpenseError,
  createExpenseRepository,
  type ExpenseScope,
} from '@/data/expense-repository';
import { createLocalStore } from '@/data/local-store';
import { LocalExpenseSchema } from '@/schemas';
import { openTestDb } from '@/test/node-sqlite';

const TRIP_ID = '0b9e7c4e-6a43-4c4b-9a55-2f6f0f7e1a01';
const OTHER_TRIP_ID = '1c0f8d5f-7b54-4d5c-8b66-3a7f1f8f2b02';
const ME = '3e2b0f7b-9d76-4f7e-8d88-5c9b3b0b4d04';
const FRIEND = '4f3c1a8c-0e87-4a8f-9e99-6d0c4c1c5e05';

const owner: ExpenseScope = { tripId: TRIP_ID, baseCurrency: 'EUR', writer: { isOwner: true, ownMemberId: null } };
const linked: ExpenseScope = { tripId: TRIP_ID, baseCurrency: 'EUR', writer: { isOwner: false, ownMemberId: ME } };

const input = { name: 'Taxi', amount: { amountMinor: 1500, currency: 'EUR' }, category: 'transport', memberId: null, spentOn: '2026-11-03' } as const;

async function setup(corrupt: jest.Mock = jest.fn()) {
  const db = openTestDb();
  await migrateLocalDb(db);
  let tick = 0;
  let id = 0;
  const store = createLocalStore(db);
  const repo = createExpenseRepository({
    db,
    store,
    now: () => new Date(Date.UTC(2026, 10, 3, 10, 0, ++tick)),
    newId: () => `00000000-0000-4000-8000-${String(++id).padStart(12, '0')}`,
    onCorruptRow: corrupt,
  });
  return { db, repo, corrupt, store };
}

describe('expense repository (expenses D5, D15; local first)', () => {
  it('adds an expense as pending with attempts 0 and a client-generated id, without any network', async () => {
    const { repo } = await setup();
    const added = await repo.add(owner, input);
    expect(LocalExpenseSchema.parse(added)).toEqual(added);
    expect(added).toMatchObject({
      id: '00000000-0000-4000-8000-000000000001',
      tripId: TRIP_ID,
      amount: { amountMinor: 1500, currency: 'EUR' },
      syncStatus: 'pending',
      attempts: 0,
      deletedAt: null,
      createdAt: '2026-11-03T10:00:01.000Z',
      updatedAt: '2026-11-03T10:00:01.000Z',
    });
    await expect(repo.list(TRIP_ID)).resolves.toEqual([added]);
  });

  it('rejects invalid input and writes nothing', async () => {
    const { repo } = await setup();
    await expect(repo.add(owner, { ...input, name: '   ' })).rejects.toThrow();
    await expect(repo.add(owner, { ...input, amount: { amountMinor: 0, currency: 'EUR' } })).rejects.toThrow();
    await expect(repo.list(TRIP_ID)).resolves.toEqual([]);
  });

  it('edit bumps updatedAt, keeps createdAt and goes back to pending with attempts reset', async () => {
    const { db, repo } = await setup();
    const added = await repo.add(owner, input);
    await db.runAsync("update expenses set sync_status = 'failed', sync_error = 'x', attempts = 3, last_attempt_at = '2026-11-03T10:00:01.500Z'", []);

    const edited = await repo.update(owner, added.id, { ...input, name: 'Bus', amount: { amountMinor: 900, currency: 'EUR' } });

    expect(edited).toMatchObject({ id: added.id, name: 'Bus', createdAt: added.createdAt, updatedAt: '2026-11-03T10:00:02.000Z', syncStatus: 'pending', attempts: 0 });
    expect(edited.syncError).toBeUndefined();
    expect(edited.lastAttemptAt).toBeUndefined();
    await expect(repo.list(TRIP_ID)).resolves.toEqual([edited]);
  });

  it('editing an unknown expense (or one of another trip) is ExpenseNotFoundError', async () => {
    const { repo } = await setup();
    const added = await repo.add({ ...owner, tripId: OTHER_TRIP_ID }, input);
    await expect(repo.update(owner, added.id, input)).rejects.toBeInstanceOf(ExpenseNotFoundError);
    await expect(repo.remove(owner, '9d3c1b2a-0f4e-4d5c-8b6a-7e8f9a0b1c2d')).rejects.toBeInstanceOf(ExpenseNotFoundError);
  });

  it('soft delete sets deletedAt and updatedAt, stays pending and leaves the list', async () => {
    const { db, repo } = await setup();
    const added = await repo.add(owner, input);
    await repo.remove(owner, added.id);
    await expect(repo.list(TRIP_ID)).resolves.toEqual([]);
    expect(await db.getAllAsync('select deleted_at, updated_at, sync_status, attempts from expenses', [])).toEqual([
      { deleted_at: '2026-11-03T10:00:02.000Z', updated_at: '2026-11-03T10:00:02.000Z', sync_status: 'pending', attempts: 0 },
    ]);
  });

  it('lists only the trip, in the order spentOn newest first then createdAt newest first', async () => {
    const { repo } = await setup();
    const a = await repo.add(owner, { ...input, spentOn: '2026-11-03' });
    const b = await repo.add(owner, { ...input, spentOn: '2026-11-05' });
    const c = await repo.add(owner, { ...input, spentOn: '2026-11-03' });
    await repo.add({ ...owner, tripId: OTHER_TRIP_ID }, input);
    expect((await repo.list(TRIP_ID)).map((e) => e.id)).toEqual([b.id, c.id, a.id]);
  });

  it('skips a damaged row and reports it', async () => {
    const { db, repo, corrupt } = await setup();
    const added = await repo.add(owner, input);
    await db.runAsync("update expenses set category = 'bogus'", []);
    await repo.add(owner, input);
    const list = await repo.list(TRIP_ID);
    expect(list).toHaveLength(1);
    expect(corrupt).toHaveBeenCalledTimes(1);
    expect(corrupt.mock.calls[0][0]).toBe(added.id);
  });

  it('rejects a currency other than the trip base currency (D5)', async () => {
    const { repo } = await setup();
    await expect(repo.add(owner, { ...input, amount: { amountMinor: 100, currency: 'USD' } })).rejects.toBeInstanceOf(CurrencyMismatchError);
    const added = await repo.add(owner, input);
    await expect(repo.update(owner, added.id, { ...input, amount: { amountMinor: 100, currency: 'USD' } })).rejects.toBeInstanceOf(CurrencyMismatchError);
    await expect(repo.list(TRIP_ID)).resolves.toEqual([added]);
  });

  it('the owner writes anyone`s expense, the organizer and friends without an account', async () => {
    const { repo } = await setup();
    const friends = await repo.add(owner, { ...input, memberId: FRIEND });
    const edited = await repo.update(owner, friends.id, { ...input, memberId: FRIEND, name: 'Lunch' });
    expect(edited.name).toBe('Lunch');
    await repo.remove(owner, friends.id);
    await expect(repo.list(TRIP_ID)).resolves.toEqual([]);
  });

  it('a linked friend adds, edits and deletes only expenses with their own memberId (D15)', async () => {
    const { repo } = await setup();
    const mine = await repo.add(linked, { ...input, memberId: ME });
    const edited = await repo.update(linked, mine.id, { ...input, memberId: ME, name: 'Mine' });
    expect(edited.name).toBe('Mine');
    await repo.remove(linked, mine.id);
    await expect(repo.list(TRIP_ID)).resolves.toEqual([]);
  });

  it('a linked friend cannot write for the organizer, for another person, or move their expense to someone else', async () => {
    const { repo } = await setup();
    await expect(repo.add(linked, { ...input, memberId: null })).rejects.toBeInstanceOf(NotYourExpenseError);
    await expect(repo.add(linked, { ...input, memberId: FRIEND })).rejects.toBeInstanceOf(NotYourExpenseError);
    const mine = await repo.add(linked, { ...input, memberId: ME });
    await expect(repo.update(linked, mine.id, { ...input, memberId: FRIEND })).rejects.toBeInstanceOf(NotYourExpenseError);
    await expect(repo.list(TRIP_ID)).resolves.toEqual([mine]);
  });

  it('a linked friend cannot edit or delete another person`s existing expense', async () => {
    const { repo } = await setup();
    const others = await repo.add(owner, { ...input, memberId: FRIEND });
    const organizers = await repo.add(owner, input);
    for (const row of [others, organizers]) {
      await expect(repo.update(linked, row.id, { ...input, memberId: ME })).rejects.toBeInstanceOf(NotYourExpenseError);
      await expect(repo.remove(linked, row.id)).rejects.toBeInstanceOf(NotYourExpenseError);
    }
    await expect(repo.list(TRIP_ID)).resolves.toEqual([organizers, others]);
  });

  it('a write in flight when clearUserData runs leaves no row; a write refused meanwhile rejects with ExpenseWriteDroppedError', async () => {
    const { db, repo, store } = await setup();
    const added = await repo.add(owner, input);
    const saving = repo.add(owner, input);
    const editing = repo.update(owner, added.id, { ...input, name: 'Bus' });
    const clearing = store.clearUserData();
    const refused = [repo.add(owner, input), repo.update(owner, added.id, input), repo.remove(owner, added.id)];
    await Promise.allSettled([saving, editing, clearing]);
    for (const call of refused) await expect(call).rejects.toBeInstanceOf(ExpenseWriteDroppedError);
    expect(await db.getAllAsync('select id from expenses', [])).toEqual([]);

    await repo.add(owner, input); // the next user
    expect(await db.getAllAsync('select id from expenses', [])).toHaveLength(1);
  });

  it('while a clearUserData has failed the phone stays closed: writes reject until a clear succeeds', async () => {
    const { db, repo, store } = await setup();
    const added = await repo.add(owner, input);
    const run = db.runAsync.bind(db);
    const spy = jest.spyOn(db, 'runAsync').mockImplementation((sql, params) => {
      if (sql.startsWith('delete from expenses')) return Promise.reject(new Error('disk full'));
      return run(sql, params);
    });
    await expect(store.clearUserData()).rejects.toThrow('disk full');
    await expect(repo.add(owner, input)).rejects.toBeInstanceOf(ExpenseWriteDroppedError);
    await expect(repo.remove(owner, added.id)).rejects.toBeInstanceOf(ExpenseWriteDroppedError);

    spy.mockRestore();
    await store.clearUserData(); // the retry opens it again
    await expect(repo.add(owner, input)).resolves.toBeDefined();
  });
});
