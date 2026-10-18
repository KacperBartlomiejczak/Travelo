import { createLocalStore } from '@/data/local-store';
import { migrateLocalDb } from '@/data/local-db';

import { openTestDb } from './node-sqlite';

/**
 * Opens the user epoch again after a test closed it (a sign-out in a test with a fake session never finishes a real clear): runs a
 * real clear on a throwaway database, the only way the epoch opens. Called after every test by jest.setup.ts. Tests only.
 */
export async function reopenUserEpoch(): Promise<void> {
  const db = openTestDb();
  await migrateLocalDb(db);
  await createLocalStore(db).clearUserData();
  db.close();
}
