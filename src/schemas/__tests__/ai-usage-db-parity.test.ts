import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Database } from '@/data/database.types';

// ai_usage / consume_ai_quota parity (places-legal-navbar plan, step C3, D17): the migration exists, the generated
// types match it, and the daily limit comes from the caller instead of being hard-coded in SQL.

const root = join(__dirname, '../../..');
const migrationsDir = join(root, 'supabase/migrations');
const migrationFile = readdirSync(migrationsDir).find((file) => file.endsWith('_ai_usage.sql'));
const migration = migrationFile ? readFileSync(join(migrationsDir, migrationFile), 'utf8') : '';
const generatedTypes = readFileSync(join(root, 'src/data/database.types.ts'), 'utf8');
const code = migration.replace(/--.*$/gm, '');
const fn = code.match(/create function public\.consume_ai_quota[\s\S]*?\n\$\$;/)?.[0] ?? '';

describe('ai_usage database parity', () => {
  it('has a migration with RLS enabled, no policies and the table revoked from clients', () => {
    expect(migrationFile).toBeDefined();
    expect(code).toMatch(/alter table public\.ai_usage enable row level security/);
    expect(code).not.toMatch(/create policy/);
    expect(code).toMatch(/revoke all on table public\.ai_usage from anon, authenticated/);
  });

  it('the generated Row type has the ai_usage columns', () => {
    const block = generatedTypes.match(/"ai_usage": \{\s*Row: \{([^}]*)\}/)?.[1] ?? '';
    expect([...block.matchAll(/"([a-z_]+)"\??:/g)].map((m) => m[1]).sort()).toEqual(['count', 'day', 'user_id']);
  });

  it('the Row type is compatible at compile time', () => {
    type Row = Database['public']['Tables']['ai_usage']['Row'];
    const columns: Record<keyof Row, true> = { count: true, day: true, user_id: true };
    expect(Object.keys(columns).sort()).toEqual(['count', 'day', 'user_id']);
  });

  it('the generated Functions entry has consume_ai_quota with p_limit and p_user_id', () => {
    const args = generatedTypes.match(/"consume_ai_quota":\s*\{ Args: \{([^}]*)\}/)?.[1] ?? '';
    expect([...args.matchAll(/"([a-z_]+)":/g)].map((m) => m[1]).sort()).toEqual(['p_limit', 'p_user_id']);
  });

  it('consume_ai_quota is service_role only and takes the limit from the caller', () => {
    expect(fn).not.toBe('');
    expect(fn).toMatch(/p_limit/);
    expect(fn).not.toMatch(/\b5\b/);
    expect(code).toMatch(/revoke execute on function public\.consume_ai_quota\(uuid, int\) from public, anon, authenticated/);
    expect(code).toMatch(/grant execute on function public\.consume_ai_quota\(uuid, int\) to service_role/);
  });
});
