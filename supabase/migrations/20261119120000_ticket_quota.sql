-- Ticket import quota kinds (ticket-import-ai plan, step 3; D4, D6, D7).
-- 'ticket' = successful AI parses, 'ticket_rejected' = non-ticket uploads (separate, higher limit).
-- The check was added inline in 20261113120000_trip_plans.sql, so Postgres named it ai_usage_kind_check.
alter table public.ai_usage drop constraint ai_usage_kind_check;
alter table public.ai_usage add constraint ai_usage_kind_check
  check (kind in ('places', 'trip_plan', 'ticket', 'ticket_rejected'));
