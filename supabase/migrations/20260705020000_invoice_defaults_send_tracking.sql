-- Track how/when each invoice was sent + link back to source order
ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS sent_via TEXT;            -- 'EMAIL' | 'WHATSAPP' | null
ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ;
ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS order_id TEXT;            -- source order's order_id (e.g. RW-123456), nullable
ALTER TABLE custom_invoices ADD COLUMN IF NOT EXISTS auto_generated BOOLEAN NOT NULL DEFAULT false;

-- Admin-configurable defaults used to prefill the invoice builder and auto-generated invoices.
CREATE TABLE IF NOT EXISTS invoice_defaults (
  id INT PRIMARY KEY DEFAULT 1,
  contact_email TEXT NOT NULL DEFAULT 'yourwriterofficial@gmail.com',
  bank_name TEXT NOT NULL DEFAULT 'Opay',
  account_name TEXT NOT NULL DEFAULT 'Richlord Jude',
  account_number TEXT NOT NULL DEFAULT '8121443666',
  developer_signature_name TEXT NOT NULL DEFAULT 'Richlord Jude',
  default_terms JSONB NOT NULL DEFAULT '["Payments made in Nigerian Naira (₦).","Invoices due immediately upon receipt.","Full IP rights transfer upon final payment.","365 days of support and bug fixes post delivery."]'::jsonb,
  default_deliverables JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_additional_services JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_exclusions JSONB NOT NULL DEFAULT '[]'::jsonb,
  default_timeline JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT invoice_defaults_singleton CHECK (id = 1)
);

INSERT INTO invoice_defaults (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE invoice_defaults ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read invoice defaults" ON invoice_defaults;
CREATE POLICY "Anyone can read invoice defaults" ON invoice_defaults FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage invoice defaults" ON invoice_defaults;
CREATE POLICY "Admins manage invoice defaults" ON invoice_defaults
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
