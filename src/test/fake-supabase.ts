import type { AuthError, SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/data/database.types';

export type FakeResponse = { data?: unknown; error?: { message: string; code?: string; details?: string } | null; status?: number };
export type RecordedQuery = { table: string; ops: [string, unknown[]][] };

/** The Storage calls the app makes (trip-photos; avatars, auth-onboarding). */
export type StorageMethod = 'upload' | 'createSignedUrl' | 'createSignedUrls' | 'list' | 'remove';
/** storage-js returns `{ data, error }` and never throws; a server answer has a `status`, a failed fetch has none. */
export type FakeStorageResponse = { data?: unknown; error?: { message: string; status?: number } | null };
export type RecordedStorageCall = { bucket: string; method: StorageMethod; args: unknown[] };

export const SIGNED_IN_USER_ID = '9d3c1b2a-0f4e-4d5c-8b6a-7e8f9a0b1c2d';

/** What `createSignedUrls` answers for `path` when a test queues nothing else. */
export function fakeSignedUrl(bucket: string, path: string): string {
  return `https://example.supabase.co/storage/v1/object/sign/${bucket}/${path}?token=fake`;
}

/**
 * A stand-in for the Supabase client: every `from(table)` chain is recorded and answered with the next queued
 * response for that table (default: no rows). `storage.from(bucket)` records its calls too and answers the next
 * queued response for the method (default: a success). `rpc` and `auth` are jest mocks. Tests only — no network.
 */
export function fakeSupabase() {
  const queries: RecordedQuery[] = [];
  const queued: Record<string, FakeResponse[]> = {};
  const storageCalls: RecordedStorageCall[] = [];
  const storageQueued: Partial<Record<StorageMethod, FakeStorageResponse[]>> = {};
  /** Every `from(table)` and Storage call in the order it was made: `from:<table>`, `storage.<method>`. */
  const sequence: string[] = [];
  type StoredSession = { access_token?: string; user: { id: string; is_anonymous: boolean } };
  const session: StoredSession = { access_token: 'access', user: { id: SIGNED_IN_USER_ID, is_anonymous: false } };
  const authSession = { access_token: 'access', refresh_token: 'refresh', user: session.user };
  /** The Supabase auth calls the app makes. Every call succeeds unless a test says otherwise; there is no anonymous sign-in. */
  const auth = {
    getSession: jest.fn(async () => ({ data: { session }, error: null as Error | null })),
    /** The background check of the stored session (auth-onboarding D22): the claims, or the error the server's answer became. */
    getClaims: jest.fn(async (_jwt?: string) => ({ data: { claims: { sub: SIGNED_IN_USER_ID } } as unknown, error: null as AuthError | null })),
    signInWithOAuth: jest.fn(async (_credentials: unknown) => ({
      data: { provider: 'google', url: 'https://example.supabase.co/auth/v1/authorize?provider=google' },
      error: null as Error | null,
    })),
    exchangeCodeForSession: jest.fn(async (_code: string) => ({ data: { session: authSession, user: session.user }, error: null as Error | null })),
    signInWithOtp: jest.fn(async (_credentials: unknown) => ({ data: { user: null, session: null }, error: null as Error | null })),
    verifyOtp: jest.fn(async (_params: unknown) => ({ data: { session: authSession, user: session.user }, error: null as Error | null })),
    signOut: jest.fn(async (_options?: unknown) => ({ error: null as Error | null })),
    onAuthStateChange: jest.fn((_callback: unknown) => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
    startAutoRefresh: jest.fn(async () => {}),
    stopAutoRefresh: jest.fn(async () => {}),
  };
  const rpc = jest.fn(async (_name: string, _args: unknown): Promise<FakeResponse> => ({ data: null, error: null, status: 204 }));

  function from(table: string) {
    sequence.push(`from:${table}`);
    const query: RecordedQuery = { table, ops: [] };
    queries.push(query);
    const builder: object = new Proxy(
      {},
      {
        get(_, prop: string) {
          if (prop === 'then') {
            const next = queued[table]?.shift() ?? {};
            const result = Promise.resolve({ data: next.data ?? null, error: next.error ?? null, status: next.status ?? 200 });
            return result.then.bind(result);
          }
          return (...args: unknown[]) => {
            query.ops.push([prop, args]);
            return builder;
          };
        },
      },
    );
    return builder;
  }

  function storageFrom(bucket: string) {
    function call(method: StorageMethod, args: unknown[], success: () => unknown) {
      storageCalls.push({ bucket, method, args });
      sequence.push(`storage.${method}`);
      const next = storageQueued[method]?.shift();
      return Promise.resolve(next ? { data: next.data ?? null, error: next.error ?? null } : { data: success(), error: null });
    }
    return {
      upload: (...args: [path: string, body: unknown, options?: unknown]) =>
        call('upload', args, () => ({ id: 'object-id', path: args[0], fullPath: `${bucket}/${args[0]}` })),
      createSignedUrl: (...args: [path: string, expiresIn: number]) =>
        call('createSignedUrl', args, () => ({ signedUrl: fakeSignedUrl(bucket, args[0]) })),
      createSignedUrls: (...args: [paths: string[], expiresIn: number]) =>
        call('createSignedUrls', args, () =>
          args[0].map((path) => ({ error: null, path, signedURL: `/object/sign/${bucket}/${path}`, signedUrl: fakeSignedUrl(bucket, path) })),
        ),
      list: (...args: [path?: string, options?: unknown]) => call('list', args, () => []),
      remove: (...args: [paths: string[]]) => call('remove', args, () => []),
    };
  }

  return {
    client: { auth, rpc, from: jest.fn(from), storage: { from: jest.fn(storageFrom) } } as unknown as SupabaseClient<Database>,
    auth,
    rpc,
    queries,
    storageCalls,
    sequence,
    /** What `getSession` answers from now on: nobody signed in, a leftover anonymous session, or a normal user. */
    storedSession(kind: 'none' | 'anonymous' | 'signed-in') {
      const stored = kind === 'none' ? null : kind === 'anonymous' ? { user: { ...session.user, is_anonymous: true } } : session;
      auth.getSession.mockImplementation(async () => ({ data: { session: stored as StoredSession }, error: null as Error | null }));
    },
    /** Answers the next `from(table)` chains, in order. */
    respond(table: string, ...responses: FakeResponse[]) {
      (queued[table] ??= []).push(...responses);
    },
    /** Answers the next Storage calls of one method, in order (any bucket). */
    respondStorage(method: StorageMethod, ...responses: FakeStorageResponse[]) {
      (storageQueued[method] ??= []).push(...responses);
    },
  };
}

/** What postgrest-js returns when fetch itself fails (no connection). */
export const NETWORK_FAILURE: FakeResponse = { error: { message: 'TypeError: Network request failed', code: '' }, status: 0 };

/**
 * What storage-js returns when fetch itself fails (no connection, timeout): a `StorageUnknownError`, which has no
 * `status`. A server answer is a `StorageApiError` with a `status` (`@supabase/storage-js` src/lib/common/fetch.ts).
 */
export const STORAGE_NETWORK_FAILURE: FakeStorageResponse = { error: { message: 'TypeError: Network request failed' } };
