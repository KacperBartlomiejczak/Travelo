import type { LocalDb } from '@/data/local-db';

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Wraps a database so that every call takes `delayMs(sql)` before it reaches it, like expo-sqlite, whose async calls run on
 * a concurrent queue (iOS) or a thread pool (Android) with no ordering between calls: a statement issued first may run last.
 * `answerDelayMs` delays the answer after the statement ran (a result that arrives late). `reached` records the statements in the order they actually reach the database. Tests only.
 */
export function reorderingDb(db: LocalDb, delayMs: (sql: string) => number, answerDelayMs: (sql: string) => number = () => 0) {
  const reached: string[] = [];
  const late = async <T>(sql: string, value: T): Promise<T> => {
    await sleep(answerDelayMs(sql));
    return value;
  };
  const wrapped: LocalDb = {
    async execAsync(sql) {
      await sleep(delayMs(sql));
      reached.push(sql);
      return late(sql, await db.execAsync(sql));
    },
    async runAsync(sql, params) {
      await sleep(delayMs(sql));
      reached.push(sql);
      return late(sql, await db.runAsync(sql, params));
    },
    async getFirstAsync<T>(sql: string, params: Parameters<LocalDb['getFirstAsync']>[1]) {
      await sleep(delayMs(sql));
      reached.push(sql);
      return late(sql, await db.getFirstAsync<T>(sql, params));
    },
    async getAllAsync<T>(sql: string, params: Parameters<LocalDb['getAllAsync']>[1]) {
      await sleep(delayMs(sql));
      reached.push(sql);
      return late(sql, await db.getAllAsync<T>(sql, params));
    },
  };
  return { db: wrapped, reached };
}

/** A small seeded random generator (mulberry32), so a failing run can be repeated. */
export function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
