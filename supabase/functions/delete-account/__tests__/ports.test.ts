import type { SupabaseClient } from '@supabase/supabase-js';
import { createPorts } from '../ports';

const UID = '3600f00f-2f28-4f54-877d-b2348ab023e3';
// A token whose payload is { sub }; the signature is irrelevant here, the auth server checks it.
const jwtFor = (sub: unknown) => `h.${Buffer.from(JSON.stringify({ sub })).toString('base64url')}.s`;

type Ctx = {
  getUser?: (jwt: string) => Promise<{ data: { user: { id: string } | null }; error: unknown }>;
  deleteUser?: (id: string) => Promise<{ error: unknown }>;
  tables?: Record<string, Array<Record<string, unknown>>>;
  files?: Record<string, string[]>;
  removeError?: unknown;
};

/** A fake of the parts of the client the ports use; tables apply `.eq` filters like Postgres would. */
function fakeAdmin(ctx: Ctx = {}) {
  const log: string[] = [];
  const admin = {
    auth: {
      getUser: ctx.getUser ?? (async () => ({ data: { user: null }, error: null })),
      admin: { deleteUser: ctx.deleteUser ?? (async () => ({ error: null })) },
    },
    from: (table: string) => ({
      select: () => {
        let rows = ctx.tables?.[table] ?? [];
        const q = {
          eq: (col: string, value: unknown) => {
            rows = rows.filter((row) => row[col] === value);
            return q;
          },
          maybeSingle: async () => ({ data: rows[0] ?? null, error: null }),
          then: (resolve: (v: unknown) => void) => resolve({ data: rows, error: null }),
        };
        return q;
      },
    }),
    storage: {
      from: (bucket: string) => ({
        list: async (folder: string, { limit, offset }: { limit: number; offset: number }) => {
          log.push(`list:${bucket}/${folder}:${limit}@${offset}`);
          const names = ctx.files?.[`${bucket}/${folder}`] ?? [];
          return { data: names.slice(offset, offset + limit).map((name) => ({ name })), error: null };
        },
        remove: async (paths: string[]) => {
          log.push(`remove:${bucket}:${paths.join(',')}`);
          return { data: [], error: ctx.removeError ?? null };
        },
      }),
    },
  };
  return { ports: createPorts(admin as unknown as SupabaseClient), log };
}

const authError = (status: number | undefined, code?: string) => ({ status, code, message: 'x' });

describe('delete-account ports', () => {
  describe('authenticate', () => {
    it('returns the user id for a good token', async () => {
      const { ports } = fakeAdmin({ getUser: async () => ({ data: { user: { id: UID } }, error: null }) });
      expect(await ports.authenticate('t')).toEqual({ kind: 'user', id: UID });
    });

    it('maps user_not_found to gone, with the id from the token', async () => {
      const { ports } = fakeAdmin({
        getUser: async () => ({ data: { user: null }, error: authError(403, 'user_not_found') }),
      });
      expect(await ports.authenticate(jwtFor(UID))).toEqual({ kind: 'gone', id: UID });
    });

    it('rejects a gone token whose sub is not a uuid', async () => {
      const { ports } = fakeAdmin({
        getUser: async () => ({ data: { user: null }, error: authError(403, 'user_not_found') }),
      });
      await expect(ports.authenticate(jwtFor('../other'))).rejects.toBeDefined();
    });

    it.each([401, 403])('maps a token rejected with %i to invalid', async (status) => {
      const { ports } = fakeAdmin({
        getUser: async () => ({ data: { user: null }, error: authError(status, 'bad_jwt') }),
      });
      expect(await ports.authenticate('t')).toEqual({ kind: 'invalid' });
    });

    it.each([429, 500, 502, undefined])('throws for status %s instead of calling the token invalid', async (status) => {
      const { ports } = fakeAdmin({ getUser: async () => ({ data: { user: null }, error: authError(status) }) });
      await expect(ports.authenticate('t')).rejects.toBeDefined();
    });
  });

  describe('ownedTripIds', () => {
    it('returns only the trips owned by the user, not those where they are a member', async () => {
      const { ports } = fakeAdmin({
        tables: {
          trips: [
            { id: 'mine', owner_id: UID },
            { id: 'theirs', owner_id: 'someone-else' },
          ],
        },
      });
      expect(await ports.ownedTripIds(UID)).toEqual(['mine']);
    });
  });

  describe('getUsername', () => {
    it('reads the profile of the user, or null', async () => {
      const { ports } = fakeAdmin({
        tables: {
          profiles: [
            { id: UID, username: 'kasia' },
            { id: 'x', username: 'other' },
          ],
        },
      });
      expect(await ports.getUsername(UID)).toBe('kasia');
      expect(await ports.getUsername('nobody')).toBeNull();
    });
  });

  describe('deleteUser', () => {
    it('returns deleted, not_found for user_not_found, and throws for other errors', async () => {
      expect(await fakeAdmin().ports.deleteUser(UID)).toBe('deleted');
      const nf = fakeAdmin({ deleteUser: async () => ({ error: authError(404, 'user_not_found') }) });
      expect(await nf.ports.deleteUser(UID)).toBe('not_found');
      const bad = fakeAdmin({ deleteUser: async () => ({ error: authError(500, 'unexpected_failure') }) });
      await expect(bad.ports.deleteUser(UID)).rejects.toBeDefined();
    });
  });

  describe('storage', () => {
    it('passes limit and offset to list and returns names', async () => {
      const { ports, log } = fakeAdmin({ files: { 'avatars/u': ['a', 'b', 'c'] } });
      expect(await ports.listFolder('avatars', 'u', 1, 2)).toEqual(['b', 'c']);
      expect(log).toEqual(['list:avatars/u:2@1']);
    });

    it('removes paths and throws when Storage reports an error', async () => {
      const ok = fakeAdmin();
      await ok.ports.removeFiles('avatars', ['u/a']);
      expect(ok.log).toEqual(['remove:avatars:u/a']);
      const bad = fakeAdmin({ removeError: { message: 'nope' } });
      await expect(bad.ports.removeFiles('avatars', ['u/a'])).rejects.toBeDefined();
    });
  });
});
