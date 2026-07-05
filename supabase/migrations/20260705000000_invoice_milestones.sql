-- Add billing fields to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS company_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone TEXT;

-- Add custom billing and milestone payment fields to orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_company TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS client_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_structure_type TEXT DEFAULT '60/40';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_milestones JSONB DEFAULT '[]'::jsonb;

-- Create custom_invoices table
CREATE TABLE IF NOT EXISTS custom_invoices (
  id BIGSERIAL PRIMARY KEY,
  invoice_number TEXT UNIQUE NOT NULL,
  client_name TEXT NOT NULL,
  company_name TEXT,
  address TEXT,
  email TEXT NOT NULL,
  phone TEXT,
  project_title TEXT NOT NULL,
  project_description TEXT,
  deliverables JSONB DEFAULT '[]'::jsonb,
  additional_services JSONB DEFAULT '[]'::jsonb,
  exclusions JSONB DEFAULT '[]'::jsonb,
  timeline JSONB DEFAULT '[]'::jsonb,
  milestones JSONB DEFAULT '[]'::jsonb,
  payment_details JSONB DEFAULT '{}'::jsonb,
  terms JSONB DEFAULT '[]'::jsonb,
  developer_signature_name TEXT,
  developer_signature_date TIMESTAMPTZ,
  client_signature_name TEXT,
  client_signature_date TIMESTAMPTZ,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'PARTIALLY_PAID', 'PAID')),
  total_amount NUMERIC NOT NULL,
  currency TEXT DEFAULT '₦',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE custom_invoices ENABLE ROW LEVEL SECURITY;

-- Policies for custom_invoices
DROP POLICY IF EXISTS "Allow public select" ON custom_invoices;
CREATE POLICY "Allow public select" ON custom_invoices FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can do everything on custom_invoices" ON custom_invoices;
CREATE POLICY "Admins can do everything on custom_invoices" ON custom_invoices 
  FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ));
