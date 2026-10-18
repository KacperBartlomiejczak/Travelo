import { openDatabaseAsync } from 'expo-sqlite';

import { migrateLocalDb, openLocalDb } from '@/data/local-db';
import { openTestDb } from '@/test/node-sqlite';

jest.mock('expo-sqlite', () => ({ openDatabaseAsync: jest.fn() }));

async function tables(db: ReturnType<typeof openTestDb>) {
  const rows = await db.getAllAsync<{ name: string }>("select name from sqlite_master where type = 'table' order by name", []);
  return rows.map((row) => row.name);
}

describe('local database', () => {
  it('creates the cache, budget change, list copy, chosen trip, photo copy and own profile copy tables and records the version', async () => {
    const db = openTestDb();
    await migrateLocalDb(db);
    expect(await tables(db)).toEqual(['my_profile_cache', 'selected_trip', 'trip_budget_changes', 'trip_list_cache', 'trip_overview_cache', 'trip_photos_cache']);
    expect(await db.getFirstAsync('pragma user_version', [])).toEqual({ user_version: 4 });
  });

  it('runs each migration once (opening again keeps the data)', async () => {
    const db = openTestDb();
    await migrateLocalDb(db);
    await db.runAsync("insert into trip_overview_cache (trip_id, overview_json, cached_at) values ('t', '{}', 'now')", []);
    await migrateLocalDb(db);
    expect(await db.getAllAsync('select trip_id from trip_overview_cache', [])).toEqual([{ trip_id: 't' }]);
  });

  it('upgrades a version 1 database to the latest version and keeps its rows (trips-drawer, trip-photos)', async () => {
    const db = openTestDb();
    // Version 1 as released (trips-supabase); migrations are never edited, so this stays true.
    await db.execAsync(`
      create table trip_overview_cache (trip_id text primary key not null, overview_json text not null, cached_at text not null);
      create table trip_budget_changes (
        trip_id text primary key not null, amount_minor integer not null, currency text not null, updated_at text not null,
        sync_status text not null, sync_error text, attempts integer not null default 0, last_attempt_at text
      );
      pragma user_version = 1;`);
    await db.runAsync("insert into trip_overview_cache (trip_id, overview_json, cached_at) values ('t', '{}', 'now')", []);
    await db.runAsync(
      "insert into trip_budget_changes (trip_id, amount_minor, currency, updated_at, sync_status) values ('t', 100, 'EUR', 'now', 'pending')",
      [],
    );

    await migrateLocalDb(db);

    expect(await db.getFirstAsync('pragma user_version', [])).toEqual({ user_version: 4 });
    expect(await tables(db)).toEqual(['my_profile_cache', 'selected_trip', 'trip_budget_changes', 'trip_list_cache', 'trip_overview_cache', 'trip_photos_cache']);
    expect(await db.getAllAsync('select trip_id from trip_overview_cache', [])).toEqual([{ trip_id: 't' }]);
    expect(await db.getAllAsync('select trip_id, amount_minor from trip_budget_changes', [])).toEqual([{ trip_id: 't', amount_minor: 100 }]);
  });

  it('upgrades a version 2 database to the latest version and keeps its rows (trip-photos)', async () => {
    const db = openTestDb();
    // Version 2 as released (trips-drawer); migrations are never edited, so this stays true.
    await db.execAsync(`
      create table trip_overview_cache (trip_id text primary key not null, overview_json text not null, cached_at text not null);
      create table trip_budget_changes (
        trip_id text primary key not null, amount_minor integer not null, currency text not null, updated_at text not null,
        sync_status text not null, sync_error text, attempts integer not null default 0, last_attempt_at text
      );
      create table trip_list_cache (id integer primary key not null check (id = 1), list_json text not null, cached_at text not null);
      create table selected_trip (id integer primary key not null check (id = 1), trip_id text not null);
      pragma user_version = 2;`);
    await db.runAsync("insert into trip_overview_cache (trip_id, overview_json, cached_at) values ('t', '{}', 'now')", []);
    await db.runAsync(
      "insert into trip_budget_changes (trip_id, amount_minor, currency, updated_at, sync_status) values ('t', 100, 'EUR', 'now', 'pending')",
      [],
    );
    await db.runAsync("insert into trip_list_cache (id, list_json, cached_at) values (1, '[]', 'now')", []);
    await db.runAsync("insert into selected_trip (id, trip_id) values (1, 't')", []);

    await migrateLocalDb(db);

    expect(await db.getFirstAsync('pragma user_version', [])).toEqual({ user_version: 4 });
    expect(await tables(db)).toEqual(['my_profile_cache', 'selected_trip', 'trip_budget_changes', 'trip_list_cache', 'trip_overview_cache', 'trip_photos_cache']);
    expect(await db.getAllAsync('select trip_id from trip_overview_cache', [])).toEqual([{ trip_id: 't' }]);
    expect(await db.getAllAsync('select trip_id, amount_minor from trip_budget_changes', [])).toEqual([{ trip_id: 't', amount_minor: 100 }]);
    expect(await db.getAllAsync('select list_json from trip_list_cache', [])).toEqual([{ list_json: '[]' }]);
    expect(await db.getAllAsync('select trip_id from selected_trip', [])).toEqual([{ trip_id: 't' }]);
    expect(await db.getAllAsync('select * from trip_photos_cache', [])).toEqual([]);
  });

  it('upgrades a version 3 database to version 4 and keeps its rows (auth-onboarding D9)', async () => {
    const db = openTestDb();
    // Version 3 as released (trip-photos); migrations are never edited, so this stays true.
    await db.execAsync(`
      create table trip_overview_cache (trip_id text primary key not null, overview_json text not null, cached_at text not null);
      create table trip_budget_changes (
        trip_id text primary key not null, amount_minor integer not null, currency text not null, updated_at text not null,
        sync_status text not null, sync_error text, attempts integer not null default 0, last_attempt_at text
      );
      create table trip_list_cache (id integer primary key not null check (id = 1), list_json text not null, cached_at text not null);
      create table selected_trip (id integer primary key not null check (id = 1), trip_id text not null);
      create table trip_photos_cache (trip_id text primary key not null, photos_json text not null, cached_at text not null);
      pragma user_version = 3;`);
    await db.runAsync("insert into trip_overview_cache (trip_id, overview_json, cached_at) values ('t', '{}', 'now')", []);
    await db.runAsync(
      "insert into trip_budget_changes (trip_id, amount_minor, currency, updated_at, sync_status) values ('t', 100, 'EUR', 'now', 'pending')",
      [],
    );
    await db.runAsync("insert into trip_list_cache (id, list_json, cached_at) values (1, '[]', 'now')", []);
    await db.runAsync("insert into selected_trip (id, trip_id) values (1, 't')", []);
    await db.runAsync("insert into trip_photos_cache (trip_id, photos_json, cached_at) values ('t', '[]', 'now')", []);

    await migrateLocalDb(db);

    expect(await db.getFirstAsync('pragma user_version', [])).toEqual({ user_version: 4 });
    expect(await db.getAllAsync('select trip_id from trip_overview_cache', [])).toEqual([{ trip_id: 't' }]);
    expect(await db.getAllAsync('select trip_id, amount_minor from trip_budget_changes', [])).toEqual([{ trip_id: 't', amount_minor: 100 }]);
    expect(await db.getAllAsync('select list_json from trip_list_cache', [])).toEqual([{ list_json: '[]' }]);
    expect(await db.getAllAsync('select trip_id from selected_trip', [])).toEqual([{ trip_id: 't' }]);
    expect(await db.getAllAsync('select trip_id, photos_json from trip_photos_cache', [])).toEqual([{ trip_id: 't', photos_json: '[]' }]);
    expect(await db.getAllAsync('select * from my_profile_cache', [])).toEqual([]);
  });

  it('keeps one row in the own profile copy', async () => {
    const db = openTestDb();
    await migrateLocalDb(db);
    await db.runAsync("insert into my_profile_cache (id, profile_json, cached_at) values (1, '{}', 'now')", []);
    await expect(db.runAsync("insert into my_profile_cache (id, profile_json, cached_at) values (2, '{}', 'now')", [])).rejects.toThrow();
  });

  it('keeps the photo copies when migrating again (the latest version is a no-op)', async () => {
    const db = openTestDb();
    await migrateLocalDb(db);
    await db.runAsync("insert into trip_photos_cache (trip_id, photos_json, cached_at) values ('t', '[]', 'now')", []);
    await migrateLocalDb(db);
    expect(await db.getFirstAsync('pragma user_version', [])).toEqual({ user_version: 4 });
    expect(await db.getAllAsync('select trip_id, photos_json from trip_photos_cache', [])).toEqual([{ trip_id: 't', photos_json: '[]' }]);
  });

  it('keeps one photo copy per trip', async () => {
    const db = openTestDb();
    await migrateLocalDb(db);
    await db.runAsync("insert into trip_photos_cache (trip_id, photos_json, cached_at) values ('t', '[]', 'now')", []);
    await expect(db.runAsync("insert into trip_photos_cache (trip_id, photos_json, cached_at) values ('t', '[]', 'later')", [])).rejects.toThrow();
  });

  it('keeps one row in the list copy and in the chosen trip', async () => {
    const db = openTestDb();
    await migrateLocalDb(db);
    await db.runAsync("insert into trip_list_cache (id, list_json, cached_at) values (1, '[]', 'now')", []);
    await expect(db.runAsync("insert into trip_list_cache (id, list_json, cached_at) values (2, '[]', 'now')", [])).rejects.toThrow();
    await db.runAsync("insert into selected_trip (id, trip_id) values (1, 't')", []);
    await expect(db.runAsync("insert into selected_trip (id, trip_id) values (2, 't')", [])).rejects.toThrow();
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
