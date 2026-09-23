-- Migration: 20260923000000_manual_payments_and_user_bank.sql
-- Description: Adds per-user assigned bank account fields and a manual_payments tracking table for manual bank transfers.

-- 1. Add assigned bank account columns to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS assigned_bank_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS assigned_account_number TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS assigned_account_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS assigned_bank_notes TEXT;

-- 2. Create manual_payments table
CREATE TABLE IF NOT EXISTS manual_payments (
  id BIGSERIAL PRIMARY KEY,
  reference TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  order_id TEXT,
  invoice_id TEXT,
  payment_type TEXT NOT NULL CHECK (payment_type IN ('ORDER_DEPOSIT', 'ORDER_MILESTONE', 'CUSTOM_INVOICE', 'WALLET_TOPUP', 'DEV_PRODUCT')),
  amount NUMERIC NOT NULL,
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  sender_name TEXT,
  receipt_url TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  admin_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES profiles(id)
);

-- 3. Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_manual_payments_user_id ON manual_payments(user_id);
CREATE INDEX IF NOT EXISTS idx_manual_payments_order_id ON manual_payments(order_id);
CREATE INDEX IF NOT EXISTS idx_manual_payments_status ON manual_payments(status);
CREATE INDEX IF NOT EXISTS idx_manual_payments_created_at ON manual_payments(created_at DESC);

-- 4. Enable Row Level Security
ALTER TABLE manual_payments ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "Users can view own manual payments" ON manual_payments;
CREATE POLICY "Users can view own manual payments" ON manual_payments
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own manual payments" ON manual_payments;
CREATE POLICY "Users can insert own manual payments" ON manual_payments
  FOR INSERT WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

DROP POLICY IF EXISTS "Admins can view and manage all manual payments" ON manual_payments;
CREATE POLICY "Admins can view and manage all manual payments" ON manual_payments
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
