import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Database } from '@/data/database.types';
import { CreateTripMemberPayloadSchema, FoundFriendSchema, TripOverviewSchema, UsernameSchema } from '@/schemas';

// Zod ↔ database parity for the friend-invite functions (prompts/friend-invite/plan.md, steps 2 and 2b): what
// `find_profile_by_friend_code` returns must be exactly FoundFriendSchema, `trip_organizer_username` must return what
// TripOverviewSchema.organizerUsername holds, and an account is linked only by a friend code (D12). The generated
// types come from the migrated database.

const root = join(__dirname, '../../..');
const migrationsDir = join(root, 'supabase/migrations');
const read = (suffix: string) => {
  const file = readdirSync(migrationsDir).find((name) => name.endsWith(suffix));
  return { file, text: file ? readFileSync(join(migrationsDir, file), 'utf8') : '' };
};
const first = read('_friend_invite.sql');
// Step 2b re-creates the lookup without the id, replaces create_trip and locks user_id; it never edits the file above.
const codeOnly = read('_friend_invite_code_only.sql');
const generatedTypes = readFileSync(join(root, 'src/data/database.types.ts'), 'utf8');
const apiConfig = readFileSync(join(root, 'supabase/config.toml'), 'utf8');

describe('Zod ↔ database parity: friend invite', () => {
  it('has a migration for the friend invite and one for linking only by code', () => {
    expect(first.file).toBeDefined();
    expect(codeOnly.file).toBeDefined();
  });

  it('the lookup returns exactly the keys of FoundFriendSchema', () => {
    const block = generatedTypes.match(/"find_profile_by_friend_code":\s*\{ Args: \{[^}]*\}; Returns: \{([^}]*)\}/)?.[1] ?? '';
    const columns = [...block.matchAll(/"([a-z_]+)":/g)].map((match) => match[1]);
    expect(columns.sort()).toEqual(Object.keys(FoundFriendSchema.shape).sort());
  });

  it('the lookup takes only the code, and the migration declares the same columns', () => {
    const args = generatedTypes.match(/"find_profile_by_friend_code":\s*\{ Args: \{([^}]*)\}/)?.[1] ?? '';
    expect([...args.matchAll(/"([a-z_]+)":/g)].map((match) => match[1])).toEqual(['code']);
    const declared = codeOnly.text.match(/create function public\.find_profile_by_friend_code\(code text\)\s*returns table \(([^)]*)\)/)?.[1] ?? '';
    const names = declared.split(',').map((column) => column.trim().split(' ')[0]);
    expect(names.sort()).toEqual(Object.keys(FoundFriendSchema.shape).sort());
  });

  it('the lookup does not return the account id', () => {
    const block = generatedTypes.match(/"find_profile_by_friend_code":\s*\{ Args: \{[^}]*\}; Returns: \{([^}]*)\}/)?.[1] ?? '';
    expect(block).not.toMatch(/"id"/);
    expect(Object.keys(FoundFriendSchema.shape)).not.toContain('id');
  });

  it('the organizer nick function takes a trip id and returns one string', () => {
    expect(generatedTypes).toMatch(/"trip_organizer_username":\s*\{ Args: \{ "trip_id": string \}; Returns: string\s*\}/);
    expect(TripOverviewSchema.shape.organizerUsername.safeParse('kacper').success).toBe(true);
    expect(UsernameSchema.safeParse('kacper').success).toBe(true);
  });

  it('the generated Function types are compatible with the schemas at compile time', () => {
    // Fails `pnpm typecheck` when a column or the result type changes on either side.
    type Functions = Database['public']['Functions'];
    type Found = Functions['find_profile_by_friend_code']['Returns'][number];
    const found: Found = { username: 'kacper', interests: ['beaches'] };
    const parsed: Pick<Found, 'username' | 'interests'> = { ...found };
    const nick: Functions['trip_organizer_username']['Returns'] = 'kacper';
    expect(Object.keys(parsed).sort()).toEqual(Object.keys(FoundFriendSchema.shape).sort());
    expect(typeof nick).toBe('string');
  });

  it('a linked friend is limited to one row per trip by a partial unique index', () => {
    expect(first.text).toMatch(
      /create unique index trip_members_trip_user_key on public\.trip_members \(trip_id, user_id\) where user_id is not null;/,
    );
  });

  it('the lookup is exact-match, security definer with an empty search_path, and closed to anon', () => {
    const body = codeOnly.text.match(/create function public\.find_profile_by_friend_code[\s\S]*?\n\$\$;/)?.[0] ?? '';
    expect(body).toMatch(/security definer set search_path = ''/);
    expect(body).toMatch(/p\.friend_code = find_profile_by_friend_code\.code/);
    expect(body).not.toMatch(/ilike|like |upper\(|lower\(/i);
    expect(codeOnly.text).toMatch(/revoke execute on function public\.find_profile_by_friend_code\(text\) from public, anon;/);
  });

  it('the create_trip member payload has the columns of trip_members except user_id, plus friend_code', () => {
    // Fails `pnpm typecheck` when a column is added to or removed from trip_members or the payload schema.
    type Insert = Database['public']['Tables']['trip_members']['Insert'];
    const columns: Record<Exclude<keyof Insert, 'user_id'> | 'friend_code', true> = {
      id: true,
      trip_id: true,
      display_name: true,
      role: true,
      interests: true,
      budget_level: true,
      pace: true,
      dietary_notes: true,
      friend_code: true,
    };
    expect(Object.keys(CreateTripMemberPayloadSchema.shape).sort()).toEqual(Object.keys(columns).sort());
    expect(Object.keys(CreateTripMemberPayloadSchema.shape)).not.toContain('user_id');
  });

  describe('linking only by code (D12)', () => {
    it('the linking helper lives in the private schema, which the Data API does not expose', () => {
      expect(codeOnly.text).toMatch(/create function private\.link_trip_member\(member_id uuid, code text\)/);
      expect(codeOnly.text).not.toMatch(/create function public\.link_trip_member/);
      const exposed = apiConfig.match(/^schemas = \[([^\]]*)\]/m)?.[1] ?? '';
      expect(exposed).not.toBe('');
      expect(exposed).not.toMatch(/private/);
    });

    it('the helper is security definer with an empty search_path, closed to anon, and raises FI001 / FI002', () => {
      const body = codeOnly.text.match(/create function private\.link_trip_member[\s\S]*?\n\$\$;/)?.[0] ?? '';
      expect(body).toMatch(/security definer set search_path = ''/);
      expect(codeOnly.text).toMatch(/revoke execute on function private\.link_trip_member\(uuid, text\) from public, anon;/);
      expect(body).toMatch(/errcode = 'FI001'/);
      expect(body).toMatch(/errcode = 'FI002'/);
    });

    it('create_trip inserts members with a null user_id and links by friend_code', () => {
      const body = codeOnly.text.match(/create or replace function public\.create_trip[\s\S]*?\n\$\$;/)?.[0] ?? '';
      expect(body).toMatch(/select m\.id, m\.trip_id, null, m\.display_name/);
      expect(body).toMatch(/perform private\.link_trip_member\(/);
      expect(body).toMatch(/security invoker set search_path = ''/);
    });

    it('the owner cannot write user_id: the insert policy requires null and the update privilege leaves it out', () => {
      expect(codeOnly.text).toMatch(/with check \(\(select private\.is_trip_owner\(trip_id\)\) and user_id is null\)/);
      const grant = codeOnly.text.match(/grant update \(([^)]*)\) on public\.trip_members to authenticated;/)?.[1] ?? '';
      const columns = grant.split(',').map((column) => column.trim());
      expect(columns).not.toContain('user_id');
      expect(columns).not.toContain('trip_id');
      expect(columns).not.toContain('id');
      expect([...columns].sort()).toEqual(['budget_level', 'dietary_notes', 'display_name', 'interests', 'pace', 'role']);
      expect(codeOnly.text).toMatch(/revoke update on public\.trip_members from authenticated;/);
    });
  });
});
