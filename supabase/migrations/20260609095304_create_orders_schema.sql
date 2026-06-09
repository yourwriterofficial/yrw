-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profiles table (extends auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  whatsapp TEXT,
  is_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Orders table
CREATE TABLE orders (
  id BIGSERIAL PRIMARY KEY,
  order_id TEXT UNIQUE NOT NULL,
  client_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  guest_email TEXT,
  guest_name TEXT,
  guest_whatsapp TEXT,
  topic TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  page_count INTEGER,
  service_tier TEXT,
  financial_quote NUMERIC,
  workflow_status TEXT DEFAULT 'Briefing Received',
  deadline DATE,
  reference_style TEXT,
  font_specification TEXT,
  sixty_percent_paid BOOLEAN DEFAULT false,
  forty_percent_paid BOOLEAN DEFAULT false,
  work_submitted BOOLEAN DEFAULT false,
  corrections_status TEXT DEFAULT 'None',
  additional_info TEXT,
  media_link TEXT,
  last_activity TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Order files (store paths in Supabase Storage)
CREATE TABLE order_files (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  uploaded_by UUID REFERENCES profiles(id)
);

-- Invoices (for Flutterwave)
CREATE TABLE invoices (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES orders(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  type TEXT CHECK (type IN ('DEPOSIT', 'BALANCE')),
  flutterwave_transaction_ref TEXT UNIQUE,
  status TEXT DEFAULT 'PENDING',
  invoice_pdf_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  paid_at TIMESTAMPTZ
);

-- Promo codes
CREATE TABLE promo_codes (
  code TEXT PRIMARY KEY,
  discount_percent INTEGER NOT NULL,
  active BOOLEAN DEFAULT true
);

-- Email logs (optional)
CREATE TABLE email_logs (
  id BIGSERIAL PRIMARY KEY,
  order_id BIGINT REFERENCES orders(id),
  recipient TEXT NOT NULL,
  subject TEXT,
  status TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ DEFAULT now()
);

-- Insert a default admin user (you'll assign later)
-- We'll create the actual admin via Supabase Auth UI

-- Enable Row Level Security on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE promo_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Policies:
-- Profiles: users can read/update their own; admins can read all
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Orders: clients see their own (by client_id or guest email); admins see all
CREATE POLICY "Clients can view own orders" ON orders FOR SELECT USING (
  auth.uid() = client_id OR guest_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);
CREATE POLICY "Admins can do anything" ON orders FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Similar policies for order_files, invoices (same logic)
-- For brevity, we'll set them after applying migration.

-- Insert a test promo code
INSERT INTO promo_codes (code, discount_percent, active) VALUES ('ELITE2026', 10, true);