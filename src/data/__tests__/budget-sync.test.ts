import { RETRY_MAX_MS, retryDelayMs, syncBudgetChanges } from '@/data/budget-sync';
import { migrateLocalDb } from '@/data/local-db';
import { createLocalStore } from '@/data/local-store';
import { fakeSupabase } from '@/test/fake-supabase';
import { openTestDb } from '@/test/node-sqlite';

describe('retry delay (backoff)', () => {
  it('doubles from 1 s with each failed attempt', () => {
    expect([1, 2, 3, 4].map(retryDelayMs)).toEqual([1000, 2000, 4000, 8000]);
  });

  it('stops growing at 5 minutes', () => {
    expect(RETRY_MAX_MS).toBe(5 * 60 * 1000);
    expect(retryDelayMs(9)).toBe(256000);
    expect(retryDelayMs(10)).toBe(RETRY_MAX_MS);
    expect(retryDelayMs(50)).toBe(RETRY_MAX_MS);
  });
});

describe('syncBudgetChanges when nobody is signed in (auth-onboarding D2)', () => {
  const CHANGE = {
    tripId: '00000000-0000-4000-8000-000000000001',
    budgetPerPerson: { amountMinor: 250000, currency: 'THB' },
    updatedAt: '2026-10-06T09:30:00.000Z',
  };
  const NOW = new Date('2026-10-06T10:00:00.000Z');

  async function setup() {
    const supabase = fakeSupabase();
    const db = openTestDb();
    await migrateLocalDb(db);
    const local = createLocalStore(db);
    await local.saveBudgetChange(CHANGE);
    return { supabase, local };
  }

  it('sends nothing, and the change stays pending without counting an attempt', async () => {
    const { supabase, local } = await setup();
    supabase.storedSession('none');

    await expect(syncBudgetChanges({ supabase: supabase.client, local, now: () => NOW })).resolves.toEqual({ nextAttemptAt: null });

    expect(supabase.queries).toEqual([]);
    await expect(local.budgetChange(CHANGE.tripId)).resolves.toEqual({ ...CHANGE, syncStatus: 'pending', attempts: 0 });
  });

  it('sends the change once someone has signed in', async () => {
    const { supabase, local } = await setup();
    supabase.storedSession('none');
    await syncBudgetChanges({ supabase: supabase.client, local, now: () => NOW });

    supabase.storedSession('signed-in');
    supabase.respond('trips', { data: [{ id: CHANGE.tripId }] });
    await syncBudgetChanges({ supabase: supabase.client, local, now: () => NOW });

    expect(supabase.queries).toHaveLength(1);
    await expect(local.budgetChange(CHANGE.tripId)).resolves.toBeNull();
  });
});
