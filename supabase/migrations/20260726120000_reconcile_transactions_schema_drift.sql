-- supabase/migrations/20260726120000_reconcile_transactions_schema_drift.sql
--
-- The live database's `transactions` table diverged from
-- 20260617000000_add_wallet_tables.sql: user_id was made nullable (guest
-- orders have no profile row) and the type/status CHECK constraints were
-- dropped (transaction types now include referral_commission, wallet_topup,
-- dev_product, withdrawal, etc., and status includes needs_review), and a
-- notes column was added. This migration codifies that drift so a fresh
-- environment restored from migrations matches production.

ALTER TABLE transactions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_type_check;
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
