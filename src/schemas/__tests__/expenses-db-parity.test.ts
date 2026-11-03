import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { Database } from '@/data/database.types';
import { CurrencyCodeSchema, EXPENSE_NAME_MAX_LENGTH, ExpenseCategorySchema, ExpenseRowSchema, ExpenseSchema } from '@/schemas';

// Zod ↔ database parity for the `expenses` table (prompts/expenses/plan.md, step 2): the checks in the migration
// must accept and reject what the schemas do, and the generated types must have the row schema's columns.

const root = join(__dirname, '../../..');
const migrationsDir = join(root, 'supabase/migrations');
const migrationFile = readdirSync(migrationsDir).find((file) => file.endsWith('_expenses.sql'));
const migration = migrationFile ? readFileSync(join(migrationsDir, migrationFile), 'utf8') : '';
const generatedTypes = readFileSync(join(root, 'src/data/database.types.ts'), 'utf8');

describe('Zod ↔ database parity: expenses', () => {
  it('has a migration for expenses', () => {
    expect(migrationFile).toBeDefined();
  });

  it('the category check accepts exactly the categories of ExpenseCategorySchema', () => {
    const list = migration.match(/category in \(([^)]+)\)/)?.[1] ?? '';
    const categories = [...list.matchAll(/'([a-z]+)'/g)].map((match) => match[1]);
    expect(categories.sort()).toEqual([...ExpenseCategorySchema.options].sort());
  });

  it('the name length check matches EXPENSE_NAME_MAX_LENGTH and the amount check is positive, as the schema is', () => {
    expect(migration).toContain(`char_length(name) between 1 and ${EXPENSE_NAME_MAX_LENGTH})`);
    expect(migration).toMatch(/amount_minor > 0/);
    expect(ExpenseSchema.shape.amount.shape.amountMinor.safeParse(0).success).toBe(false);
  });

  it('the currency check and CurrencyCodeSchema agree on valid and invalid values', () => {
    const pattern = new RegExp(migration.match(/currency ~ '([^']+)'/)?.[1] ?? '(?!)');
    for (const value of ['THB', 'PLN', 'EUR', 'thb', 'TH', 'THBB', '', 'T1B', 'THB ']) {
      expect([value, pattern.test(value)]).toEqual([value, CurrencyCodeSchema.safeParse(value).success]);
    }
  });

  it('the generated Row type has exactly the columns of ExpenseRowSchema', () => {
    const block = generatedTypes.match(/"expenses": \{\s*Row: \{([^}]*)\}/)?.[1] ?? '';
    const columns = [...block.matchAll(/"([a-z_]+)"\??:/g)].map((match) => match[1]);
    expect(columns.sort()).toEqual(Object.keys(ExpenseRowSchema.shape).sort());
  });

  it('the Row type is compatible with the row schema at compile time', () => {
    // Fails `pnpm typecheck` when a column is added to or removed from either side.
    type Row = Database['public']['Tables']['expenses']['Row'];
    const columns: Record<keyof Row, true> = {
      id: true,
      trip_id: true,
      member_id: true,
      name: true,
      amount_minor: true,
      currency: true,
      category: true,
      spent_on: true,
      created_at: true,
      updated_at: true,
      deleted_at: true,
    };
    expect(Object.keys(columns).sort()).toEqual(Object.keys(ExpenseRowSchema.shape).sort());
  });
});
