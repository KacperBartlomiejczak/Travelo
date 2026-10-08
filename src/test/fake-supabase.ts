import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '@/data/database.types';

export type FakeResponse = { data?: unknown; error?: { message: string; code?: string } | null; status?: number };
export type RecordedQuery = { table: string; ops: [string, unknown[]][] };

export const SIGNED_IN_USER_ID = '9d3c1b2a-0f4e-4d5c-8b6a-7e8f9a0b1c2d';

/**
 * A stand-in for the Supabase client: every `from(table)` chain is recorded and answered with the next queued
 * response for that table (default: no rows). `rpc` and `auth` are jest mocks. Tests only — no network.
 */
export function fakeSupabase() {
  const queries: RecordedQuery[] = [];
  const queued: Record<string, FakeResponse[]> = {};
  const session = { user: { id: SIGNED_IN_USER_ID } };
  const auth = {
    getSession: jest.fn(async () => ({ data: { session }, error: null as Error | null })),
    signInAnonymously: jest.fn(async () => ({ data: { session, user: session.user }, error: null as Error | null })),
    startAutoRefresh: jest.fn(async () => {}),
    stopAutoRefresh: jest.fn(async () => {}),
  };
  const rpc = jest.fn(async (_name: string, _args: unknown): Promise<FakeResponse> => ({ data: null, error: null, status: 204 }));

  function from(table: string) {
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

  return {
    client: { auth, rpc, from: jest.fn(from) } as unknown as SupabaseClient<Database>,
    auth,
    rpc,
    queries,
    /** Answers the next `from(table)` chains, in order. */
    respond(table: string, ...responses: FakeResponse[]) {
      (queued[table] ??= []).push(...responses);
    },
  };
}

/** What postgrest-js returns when fetch itself fails (no connection). */
export const NETWORK_FAILURE: FakeResponse = { error: { message: 'TypeError: Network request failed', code: '' }, status: 0 };
