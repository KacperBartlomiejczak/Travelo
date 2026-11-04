// The real ports of the account deletion handler, on top of an injected Supabase client (service role).
// No Deno globals, so Jest tests it with a fake client. Every port throws on an unexpected failure.
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AccountPorts } from './handler.ts';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The `sub` of a token the auth server has already accepted as signed; it is used as a Storage folder, so it must be a uuid. */
function subOf(jwt: string): string {
  const sub: unknown = JSON.parse(atob((jwt.split('.')[1] ?? '').replace(/-/g, '+').replace(/_/g, '/'))).sub;
  if (typeof sub !== 'string' || !UUID.test(sub)) throw new Error('token has no uuid subject');
  return sub;
}

export function createPorts(admin: SupabaseClient): AccountPorts {
  return {
    async authenticate(jwt) {
      const { data, error } = await admin.auth.getUser(jwt);
      if (data.user) return { kind: 'user', id: data.user.id };
      // The auth server checks the signature first, so `user_not_found` means a genuine token of a deleted user.
      if (error?.code === 'user_not_found') return { kind: 'gone', id: subOf(jwt) };
      // Only a rejected token is invalid; rate limits (429), 5xx and network errors are failures, not a wrong token.
      if (error?.status === 401 || error?.status === 403) return { kind: 'invalid' };
      throw error ?? new Error('getUser returned no user');
    },
    async getUsername(userId) {
      const { data, error } = await admin.from('profiles').select('username').eq('id', userId).maybeSingle();
      if (error) throw error;
      return data?.username ?? null;
    },
    async ownedTripIds(userId) {
      const { data, error } = await admin.from('trips').select('id').eq('owner_id', userId);
      if (error) throw error;
      return data.map(({ id }) => id);
    },
    async listFolder(bucket, folder, offset, limit) {
      const { data, error } = await admin.storage.from(bucket).list(folder, { limit, offset });
      if (error) throw error;
      return data.map(({ name }) => name);
    },
    async removeFiles(bucket, paths) {
      const { error } = await admin.storage.from(bucket).remove(paths);
      if (error) throw error;
    },
    async deleteUser(userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error?.code === 'user_not_found') return 'not_found';
      if (error) throw error;
      return 'deleted';
    },
  };
}
