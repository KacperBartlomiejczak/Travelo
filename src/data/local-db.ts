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
];

export async function migrateLocalDb(db: LocalDb): Promise<void> {
  const current = (await db.getFirstAsync<{ user_version: number }>('pragma user_version', []))?.user_version ?? 0;
  for (let version = current + 1; version <= MIGRATIONS.length; version++) {
    await db.execAsync(`begin; ${MIGRATIONS[version - 1]} pragma user_version = ${version}; commit;`);
  }
}

/** The app's SQLite database (budget changes and the nearest-trip copy, trips-supabase D1, D6). */
export async function openLocalDb(): Promise<LocalDb> {
  const db = await openDatabaseAsync('travelo.db');
  await migrateLocalDb(db);
  return db;
}
