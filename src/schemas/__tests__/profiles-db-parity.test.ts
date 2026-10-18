import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Database } from '@/data/database.types';
import {
  FRIEND_CODE_ALPHABET,
  FRIEND_CODE_LENGTH,
  FriendCodeSchema,
  InterestTagSchema,
  ProfileSchema,
  UsernameSchema,
} from '@/schemas';

// Zod ↔ database parity for the `profiles` table (prompts/auth-onboarding/plan.md, step 2): the checks in the
// migration must accept and reject exactly what the schemas do, and the generated types must have the schema's columns.

const root = join(__dirname, '../../..');
const migrationsDir = join(root, 'supabase/migrations');
const migrationFile = readdirSync(migrationsDir).find((file) => file.endsWith('_profiles.sql'));
const migration = migrationFile ? readFileSync(join(migrationsDir, migrationFile), 'utf8') : '';
const generatedTypes = readFileSync(join(root, 'src/data/database.types.ts'), 'utf8');

// Postgres and JavaScript read these patterns the same way (anchors, character classes, counted repeats).
const positive = migration.match(/username ~ '([^']+)'/)?.[1] ?? '';
const negatives = [...migration.matchAll(/username !~ '([^']+)'/g)].map((match) => match[1]);

function usernameAcceptedByDatabase(value: string): boolean {
  return new RegExp(positive).test(value) && negatives.every((pattern) => !new RegExp(pattern).test(value));
}

const snake = (key: string) => key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);

describe('Zod ↔ database parity: profiles', () => {
  it('has a migration for profiles', () => {
    expect(migrationFile).toBeDefined();
  });

  it('the nick check is one pattern and two negative checks', () => {
    expect(positive).not.toBe('');
    expect(negatives).toHaveLength(2);
  });

  it('the nick check of the database and UsernameSchema agree on valid and invalid values', () => {
    const values = [
      'kacper', 'kacper_b', 'k.b.2', 'abc', 'a'.repeat(20), 'a_b', 'a.b',
      'Kacper', 'ab', '', 'a'.repeat(21), 'kac..per', 'kacper.', '.kacper', '_kacper', '1abc', 'kac per', 'kąper',
      'kacper\n', '\nkacper', 'kacper-b', 'kacper@b', 'a..', 'a.b.', 'a.b..c', 'KACPER', 'ab.', 'a1.',
    ];
    for (const value of values) {
      expect([value, usernameAcceptedByDatabase(value)]).toEqual([value, UsernameSchema.safeParse(value).success]);
    }
  });

  it('the friend code check of the database accepts exactly FRIEND_CODE_ALPHABET, 6 characters', () => {
    const check = migration.match(/friend_code ~ '\^\[([^\]]+)\]\{(\d+)\}\$'/);
    expect(check).not.toBeNull();
    expect([...(check?.[1] ?? '')].sort()).toEqual([...FRIEND_CODE_ALPHABET].sort());
    expect(Number(check?.[2])).toBe(FRIEND_CODE_LENGTH);
  });

  describe('the friend-code trigger function', () => {
    const body = migration.match(/create function private\.set_friend_code\(\)[\s\S]*?\n\$\$;/)?.[0] ?? '';
    const alphabet = body.match(/alphabet constant text := '([^']*)'/)?.[1] ?? '';

    it('draws from exactly FRIEND_CODE_ALPHABET (same characters, same length)', () => {
      expect(body).not.toBe('');
      expect(alphabet).not.toBe('');
      expect([...alphabet].sort()).toEqual([...FRIEND_CODE_ALPHABET].sort());
      expect(alphabet).toHaveLength(FRIEND_CODE_ALPHABET.length);
    });

    it('builds codes of FRIEND_CODE_LENGTH characters', () => {
      expect(Number(body.match(/while length\(candidate\) < (\d+) loop/)?.[1])).toBe(FRIEND_CODE_LENGTH);
      expect(Number(body.match(/if byte_value < \d+ and length\(candidate\) < (\d+) then/)?.[1])).toBe(FRIEND_CODE_LENGTH);
    });

    it('maps bytes without modulo bias: the modulus is the alphabet length and the cut-off is the largest multiple of it below 256', () => {
      const modulus = Number(body.match(/byte_value % (\d+)/)?.[1]);
      const cutOff = Number(body.match(/if byte_value < (\d+) and/)?.[1]);
      expect(modulus).toBe(FRIEND_CODE_ALPHABET.length);
      expect(cutOff).toBe(Math.floor(256 / FRIEND_CODE_ALPHABET.length) * FRIEND_CODE_ALPHABET.length);
    });
  });

  it('the friend code check and FriendCodeSchema agree on valid and invalid values', () => {
    const pattern = new RegExp(migration.match(/friend_code ~ '([^']+)'/)?.[1] ?? '(?!)');
    const values = [
      'K7QX2M', 'ABCDEF', '234567', 'ZZZZZZ',
      '', 'K7QX2', 'K7QX2MM', 'k7qx2m', 'K7QX20', 'K7QX2O', 'K7QX21', 'K7QX2I', 'K7QX2L', 'K7QX2 ', 'K7QX2M\n',
    ];
    for (const value of values) {
      expect([value, pattern.test(value)]).toEqual([value, FriendCodeSchema.safeParse(value).success]);
    }
  });

  it('the interests check of profiles accepts exactly the tags of InterestTagSchema', () => {
    const list = migration.match(/interests <@ array\[([^\]]+)\]/)?.[1] ?? '';
    const tags = [...list.matchAll(/'([a-z_]+)'/g)].map((match) => match[1]);
    expect(tags.sort()).toEqual([...InterestTagSchema.options].sort());
  });

  it('requires at least one interest, as ProfileSchema does', () => {
    expect(migration).toMatch(/cardinality\(interests\)\s*>=\s*1/);
    expect(ProfileSchema.shape.interests.safeParse([]).success).toBe(false);
  });

  it('the generated Row type has exactly the columns of ProfileSchema (snake_case)', () => {
    const block = generatedTypes.match(/"profiles": \{\s*Row: \{([^}]*)\}/)?.[1] ?? '';
    const columns = [...block.matchAll(/"([a-z_]+)"\??:/g)].map((match) => match[1]);
    expect(columns.sort()).toEqual(Object.keys(ProfileSchema.shape).map(snake).sort());
  });

  it('the Row type is compatible with the schema columns at compile time', () => {
    // Fails `pnpm typecheck` when a column is added to or removed from either side.
    type Row = Database['public']['Tables']['profiles']['Row'];
    const columns: Record<keyof Row, true> = {
      id: true,
      username: true,
      friend_code: true,
      interests: true,
      avatar_id: true,
      created_at: true,
      updated_at: true,
    };
    expect(Object.keys(columns).sort()).toEqual(Object.keys(ProfileSchema.shape).map(snake).sort());
  });
});
