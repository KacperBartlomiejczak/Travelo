import { openTestDb } from '@/test/node-sqlite';
import { migrateLocalDb } from '@/data/local-db';
import { createLocalStore } from '@/data/local-store';
import {
  readLanguagePreference,
  readThemePreference,
  writeLanguagePreference,
  writeThemePreference,
} from '@/data/preferences';

// kv-store is a separate expo-sqlite database ('ExpoSQLiteStorage'), not travelo.db that local-store.ts wraps.
const mockKv = new Map<string, string>();
let mockFailRead = false;
jest.mock('expo-sqlite/kv-store', () => ({
  Storage: {
    getItemSync: (key: string) => {
      if (mockFailRead) throw new Error('storage down');
      return mockKv.get(key) ?? null;
    },
    setItemSync: (key: string, value: string) => void mockKv.set(key, value),
  },
}));

beforeEach(() => {
  mockKv.clear();
  mockFailRead = false;
});

describe('preferences', () => {
  it('defaults to system when nothing is saved', () => {
    expect(readThemePreference()).toBe('system');
    expect(readLanguagePreference()).toBe('system');
  });

  it('writes and reads both settings', () => {
    writeThemePreference('dark');
    writeLanguagePreference('pl');
    expect(readThemePreference()).toBe('dark');
    expect(readLanguagePreference()).toBe('pl');
  });

  it('treats an unknown stored value as system', () => {
    mockKv.set('preference.theme', 'purple');
    mockKv.set('preference.language', 'de');
    expect(readThemePreference()).toBe('system');
    expect(readLanguagePreference()).toBe('system');
  });

  it('falls back to system when the storage read fails', () => {
    mockFailRead = true;
    expect(readThemePreference()).toBe('system');
    expect(readLanguagePreference()).toBe('system');
  });

  it('survives clearUserData (D8)', async () => {
    writeThemePreference('light');
    writeLanguagePreference('en');
    const db = openTestDb();
    await migrateLocalDb(db);
    await createLocalStore(db).clearUserData();
    expect(readThemePreference()).toBe('light');
    expect(readLanguagePreference()).toBe('en');
  });
});
