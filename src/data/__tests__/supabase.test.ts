import { createClient } from '@supabase/supabase-js';

import { withTimeout } from '@/data/fetch-timeout';
import { installWebCrypto } from '@/data/web-crypto';

const mockPolyfillLoaded = jest.fn();
const mockTimedFetch = jest.fn();

jest.mock('@/data/web-crypto', () => ({ installWebCrypto: jest.fn() }));
jest.mock('@/data/fetch-timeout', () => ({ REQUEST_TIMEOUT_MS: 20_000, withTimeout: jest.fn(() => mockTimedFetch) }));

const mockAuth = { startAutoRefresh: jest.fn(), stopAutoRefresh: jest.fn() };
jest.mock('@supabase/supabase-js', () => ({ createClient: jest.fn(() => ({ auth: mockAuth })) }));
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
        flowType: 'pkce',
      },
      global: { fetch: mockTimedFetch },
    });
  });

  it('gives every request (database, RPC, auth) the 20 s timeout (trips-supabase D14)', () => {
    loadClient({ url: URL, key: KEY });
    expect(withTimeout).toHaveBeenCalledWith(globalThis.fetch, 20_000);
  });

  it('loads the URL polyfill before creating the client (Supabase Expo quickstart)', () => {
    mockPolyfillLoaded.mockClear();
    loadClient({ url: URL, key: KEY });
    expect(mockPolyfillLoaded).toHaveBeenCalled();
    expect(mockPolyfillLoaded.mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(createClient).mock.invocationCallOrder[0]);
  });

  it('installs the WebCrypto polyfill before creating the client, so PKCE uses S256 (pkce-sha256)', () => {
    jest.mocked(installWebCrypto).mockClear();
    loadClient({ url: URL, key: KEY });
    expect(installWebCrypto).toHaveBeenCalledTimes(1);
    expect(jest.mocked(installWebCrypto).mock.invocationCallOrder[0]).toBeLessThan(jest.mocked(createClient).mock.invocationCallOrder[0]);
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

// Supabase React Native guidance: the foreground listener "should only be registered once", so it lives next to the client
// (auth-onboarding D22). The listener's own behaviour is `keepSessionFresh`, tested in auth.test.ts; here it is only wired.
describe('supabase client — token refresh follows the app state', () => {
  type Listener = (state: string) => void;

  /** Loads the client module in its own registry with `os` as the platform; returns the listeners it registered. */
  function loadOn(os: 'ios' | 'android' | 'web') {
    process.env.EXPO_PUBLIC_SUPABASE_URL = URL;
    process.env.EXPO_PUBLIC_SUPABASE_KEY = KEY;
    const listeners: Listener[] = [];
    jest.isolateModules(() => {
      /* eslint-disable @typescript-eslint/no-require-imports */
      const { AppState, Platform } = require('react-native') as typeof import('react-native');
      Platform.OS = os;
      jest.spyOn(AppState, 'addEventListener').mockImplementation(((_type: string, listener: Listener) => {
        listeners.push(listener);
        return { remove: jest.fn() };
      }) as unknown as typeof AppState.addEventListener);
      require('@/data/supabase');
      /* eslint-enable @typescript-eslint/no-require-imports */
    });
    return listeners;
  }

  beforeEach(() => {
    mockAuth.startAutoRefresh.mockClear();
    mockAuth.stopAutoRefresh.mockClear();
  });

  it.each(['ios', 'android'] as const)('registers exactly one app state listener when the module is loaded on %s', (os) => {
    expect(loadOn(os)).toHaveLength(1);
  });

  it('registers none on web (the browser handles it)', () => {
    expect(loadOn('web')).toHaveLength(0);
  });

  it('starts the token refresh when the app becomes active, and stops it when it goes to the background or becomes inactive', () => {
    const [listener] = loadOn('ios');
    listener('active');
    expect(mockAuth.startAutoRefresh).toHaveBeenCalledTimes(1);
    expect(mockAuth.stopAutoRefresh).not.toHaveBeenCalled();

    listener('background');
    listener('inactive');
    expect(mockAuth.stopAutoRefresh).toHaveBeenCalledTimes(2);
    expect(mockAuth.startAutoRefresh).toHaveBeenCalledTimes(1);
  });
});
