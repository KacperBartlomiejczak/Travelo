import { openDatabaseAsync } from 'expo-sqlite';

import { migrateLocalDb, openLocalDb } from '@/data/local-db';
import { openTestDb } from '@/test/node-sqlite';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

async function tables(db: ReturnType<typeof openTestDb>) {
  const rows = await db.getAllAsync<{ name: string }>("select name from sqlite_master where type = 'table' order by name", []);
  return rows.map((row) => row.name);
}

describe('local database', () => {
  it('creates the cache and budget change tables and records the version', async () => {
    const db = openTestDb();
    await migrateLocalDb(db);
    expect(await tables(db)).toEqual(['trip_budget_changes', 'trip_overview_cache']);
    expect(await db.getFirstAsync('pragma user_version', [])).toEqual({ user_version: 1 });
  });

  it('runs each migration once (opening again keeps the data)', async () => {
    const db = openTestDb();
    await migrateLocalDb(db);
    await db.runAsync("insert into trip_overview_cache (trip_id, overview_json, cached_at) values ('t', '{}', 'now')", []);
    await migrateLocalDb(db);
    expect(await db.getAllAsync('select trip_id from trip_overview_cache', [])).toEqual([{ trip_id: 't' }]);
  });

  it('rolls a failed migration back and leaves the database usable', async () => {
    const db = openTestDb();
    // A leftover table makes the first migration fail half-way.
    await db.execAsync('create table trip_overview_cache (x text)');
    await expect(migrateLocalDb(db)).rejects.toThrow();
    expect(await db.getFirstAsync('pragma user_version', [])).toEqual({ user_version: 0 });
    await expect(db.execAsync('begin; commit;')).resolves.toBeUndefined();
  });

  it('stores money as INTEGER minor units', async () => {
    const db = openTestDb();
    await migrateLocalDb(db);
    const columns = await db.getAllAsync<{ name: string; type: string }>('pragma table_info(trip_budget_changes)', []);
    expect(columns.find((column) => column.name === 'amount_minor')?.type).toBe('INTEGER');
  });

  it('opens the app database file and migrates it', async () => {
    const db = openTestDb();
    jest.mocked(openDatabaseAsync).mockResolvedValue(db as never);
    await expect(openLocalDb()).resolves.toBe(db);
    expect(openDatabaseAsync).toHaveBeenCalledWith('travelo.db');
    expect(await tables(db)).toContain('trip_budget_changes');
  });
});
