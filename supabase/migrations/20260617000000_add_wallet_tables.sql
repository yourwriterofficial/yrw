-- supabase/migrations/20260617000000_add_wallet_tables.sql

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own wallet" ON wallets;
DROP POLICY IF EXISTS "Admins can view all wallets" ON wallets;
DROP POLICY IF EXISTS "Admins can update any wallet" ON wallets;
DROP POLICY IF EXISTS "Users can view own transactions" ON transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON transactions;
DROP POLICY IF EXISTS "Allow insert for authenticated users" ON transactions;

-- Create tables if they don't exist
CREATE TABLE IF NOT EXISTS wallets (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  balance BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS transactions (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('deposit', 'payment')),
  reference TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Add updated_at column if missing
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Drop and recreate function
DROP FUNCTION IF EXISTS increment_wallet(UUID, BIGINT);

CREATE OR REPLACE FUNCTION increment_wallet(
  user_id UUID,
  add_amount BIGINT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_balance BIGINT;
BEGIN
  UPDATE wallets
  SET balance = balance + add_amount,
      updated_at = now()
  WHERE wallets.user_id = increment_wallet.user_id
  RETURNING balance INTO new_balance;

  IF NOT FOUND THEN
    INSERT INTO wallets (user_id, balance, updated_at)
    VALUES (increment_wallet.user_id, add_amount, now())
    RETURNING balance INTO new_balance;
  END IF;

  RETURN new_balance;
END;
$$;

-- Enable RLS
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own wallet" ON wallets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all wallets" ON wallets
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ));

CREATE POLICY "Admins can update any wallet" ON wallets
  FOR UPDATE USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ));

CREATE POLICY "Users can view own transactions" ON transactions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all transactions" ON transactions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ));

CREATE POLICY "Allow insert for authenticated users" ON transactions
  FOR INSERT WITH CHECK (auth.role() = 'authenticated');