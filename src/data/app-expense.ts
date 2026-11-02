import { appLocalDb, appLocalStore } from './app-local-store';
import { createExpenseRepository, type ExpenseRepository } from './expense-repository';
import { createExpenseSync, type ExpenseSync } from './expense-sync';
import { supabase } from './supabase';

// The app has no error reporting yet: a damaged row is skipped and logged.
const onCorruptRow = (id: string, error: unknown) => console.warn(`Skipped damaged expense ${id}`, error);

const opened = () => Promise.all([appLocalDb(), appLocalStore()]);

/** The app's expenses: SQLite on the device (expenses D5). Methods wait for the database to open. */
export function createAppExpenseRepository(): ExpenseRepository {
  const repository = () => opened().then(([db, store]) => createExpenseRepository({ db, store, onCorruptRow }));
  return {
    add: async (...args) => (await repository()).add(...args),
    update: async (...args) => (await repository()).update(...args),
    remove: async (...args) => (await repository()).remove(...args),
    list: async (...args) => (await repository()).list(...args),
  };
}

/** Pushes the device's expenses to Supabase and pulls the trips' expenses (expenses D16). */
export function createAppExpenseSync(): Pick<ExpenseSync, 'sync'> {
  const sync = () => opened().then(([db, store]) => createExpenseSync({ supabase, db, store, onCorruptRow }));
  let created: ReturnType<typeof sync> | null = null;
  // One sync object, so its queue (one run at a time) is shared; a failed open is retried by the next call.
  return {
    sync: async () => {
      created ??= sync();
      try {
        return await (await created).sync();
      } catch (error) {
        created = null;
        throw error;
      }
    },
  };
}
