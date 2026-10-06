#!/usr/bin/env sh
# Runs the SQL tests in supabase/tests/ against an already migrated database.
# Local Supabase: DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres pnpm test:db
# Each test file runs in a transaction that is rolled back, so it leaves no data behind.
set -eu

if [ -z "${DB_URL:-}" ]; then
  echo "DB_URL is not set (the local Supabase database URL from 'supabase status')." >&2
  exit 1
fi

for file in "$(dirname "$0")"/../supabase/tests/*.sql; do
  echo "→ $file"
  psql "$DB_URL" --quiet --no-psqlrc -v ON_ERROR_STOP=1 -f "$file"
done
echo "All database tests passed."
