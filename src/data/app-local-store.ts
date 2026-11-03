import { openLocalDb, type LocalDb } from './local-db';
import { createLocalStore, type LocalStore } from './local-store';

let database: Promise<LocalDb> | null = null;
let store: Promise<LocalStore> | null = null;

/** The app's one SQLite database, opened on first use. A failed open is not kept: the next call tries again. */
export function appLocalDb(): Promise<LocalDb> {
  if (database) return database;
  const opening = openLocalDb();
  database = opening;
  opening.catch(() => {
    if (database === opening) database = null;
  });
  return opening;
}

/**
 * The app's one SQLite store, opened on first use and shared by the trip and profile repositories (the database is opened once).
 * A failed open is not kept: the next call tries again, so a database that was locked for a moment does not stay broken until the app restarts.
 */
export function appLocalStore(): Promise<LocalStore> {
  if (store) return store;
  const opening = appLocalDb().then(createLocalStore);
  store = opening;
  opening.catch(() => {
    if (store === opening) store = null;
  });
  return opening;
}
