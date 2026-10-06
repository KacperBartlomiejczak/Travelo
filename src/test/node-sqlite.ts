import type { SQLiteBindValue } from 'expo-sqlite';
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';

import type { LocalDb } from '@/data/local-db';

/** A real in-memory SQLite (Node's built-in) behind the part of the expo-sqlite API the app uses. Tests only. */
export function openTestDb(): LocalDb & { close: () => void } {
  const db = new DatabaseSync(':memory:');
  // The app binds only text, numbers and null; booleans become 0/1 as in SQLite.
  const values = (params: SQLiteBindValue[]) =>
    params.map((value): SQLInputValue => {
      if (typeof value === 'boolean') return Number(value);
      if (value instanceof ArrayBuffer) return new Uint8Array(value);
      return value;
    });
  return {
    async execAsync(sql) {
      db.exec(sql);
    },
    async runAsync(sql, params) {
      const result = db.prepare(sql).run(...values(params));
      return { changes: Number(result.changes) };
    },
    async getFirstAsync<T>(sql: string, params: Parameters<LocalDb['getFirstAsync']>[1]) {
      return (db.prepare(sql).get(...values(params)) as T | undefined) ?? null;
    },
    async getAllAsync<T>(sql: string, params: Parameters<LocalDb['getAllAsync']>[1]) {
      return db.prepare(sql).all(...values(params)) as T[];
    },
    close: () => db.close(),
  };
}
