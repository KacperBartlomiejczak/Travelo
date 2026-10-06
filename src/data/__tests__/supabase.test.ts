import { createClient } from '@supabase/supabase-js';

const mockPolyfillLoaded = jest.fn();

jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({})) }));
jest.mock('react-native-url-polyfill/auto', () => mockPolyfillLoaded());
jest.mock('expo-sqlite/localStorage/install', () => {
  (globalThis as { localStorage?: unknown }).localStorage = { name: 'sqlite-local-storage' };
});

const URL = 'https://example.supabase.co';
const KEY = 'sb_publishable_test';

function loadClient(env: { url?: string; key?: string }) {
  process.env.EXPO_PUBLIC_SUPABASE_URL = env.url;
  process.env.EXPO_PUBLIC_SUPABASE_KEY = env.key;
  if (env.url === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_URL;
  if (env.key === undefined) delete process.env.EXPO_PUBLIC_SUPABASE_KEY;
  jest.isolateModules(() => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    require('@/data/supabase');
  });
}

describe('supabase client', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    jest.mocked(createClient).mockClear();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('creates the client from env with the session kept in SQLite localStorage', () => {
    loadClient({ url: URL, key: KEY });

    expect(createClient).toHaveBeenCalledWith(URL, KEY, {
      auth: {
        storage: { name: 'sqlite-local-storage' },
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    });
  });

  it('loads the URL polyfill before creating the client (Supabase Expo quickstart)', () => {
    mockPolyfillLoaded.mockClear();
    loadClient({ url: URL, key: KEY });
    expect(mockPolyfillLoaded).toHaveBeenCalled();
    expect(mockPolyfillLoaded.mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(createClient).mock.invocationCallOrder[0]);
  });

  it('names the missing variable', () => {
    expect(() => loadClient({ key: KEY })).toThrow('EXPO_PUBLIC_SUPABASE_URL');
    expect(createClient).not.toHaveBeenCalled();
  });

  it('refuses a secret key', () => {
    expect(() => loadClient({ url: URL, key: 'sb_secret_abc123' })).toThrow('EXPO_PUBLIC_SUPABASE_KEY');
    expect(createClient).not.toHaveBeenCalled();
  });
});
