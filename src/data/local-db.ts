import { openDatabaseAsync, type SQLiteBindValue } from 'expo-sqlite';

/** The part of expo-sqlite's database the app uses (tests use Node's SQLite behind the same shape). */
export interface LocalDb {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, params: SQLiteBindValue[]): Promise<{ changes: number }>;
  getFirstAsync<T>(sql: string, params: SQLiteBindValue[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params: SQLiteBindValue[]): Promise<T[]>;
}

/** Versioned local migrations: index + 1 = version. Never edit one after release; add a new one. */
const MIGRATIONS = [
  `create table trip_overview_cache (
     trip_id text primary key not null,
     overview_json text not null,
     cached_at text not null
   );
   create table trip_budget_changes (
     trip_id text primary key not null,
     amount_minor integer not null,
     currency text not null,
     updated_at text not null,
     sync_status text not null,
     sync_error text,
     attempts integer not null default 0,
     last_attempt_at text
   );`,
  // trips-drawer: the side panel's list copy (one row) and the trip the organizer chose (one row).
  `create table trip_list_cache (
     id integer primary key not null check (id = 1),
     list_json text not null,
     cached_at text not null
   );
   create table selected_trip (
     id integer primary key not null check (id = 1),
     trip_id text not null
   );`,
];

export async function migrateLocalDb(db: LocalDb): Promise<void> {
  const current = (await db.getFirstAsync<{ user_version: number }>('pragma user_version', []))?.user_version ?? 0;
  for (let version = current + 1; version <= MIGRATIONS.length; version++) {
    try {
      await db.execAsync(`begin; ${MIGRATIONS[version - 1]} pragma user_version = ${version}; commit;`);
    } catch (error) {
      await db.execAsync('rollback').catch(() => {});
      throw error;
    }
  }
}

/** The app's SQLite database (budget changes and trip copies, trips-supabase D1, D6; the chosen trip, trips-drawer D2, D3). */
export async function openLocalDb(): Promise<LocalDb> {
  const db = await openDatabaseAsync('travelo.db');
  await migrateLocalDb(db);
  return db;
}
