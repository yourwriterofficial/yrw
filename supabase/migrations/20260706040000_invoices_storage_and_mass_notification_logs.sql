-- Private storage bucket for generated invoice images/PDFs (signed URLs only —
-- invoices carry client PII, so this must never be a public bucket).
INSERT INTO storage.buckets (id, name, public)
VALUES ('invoices', 'invoices', false)
ON CONFLICT (id) DO NOTHING;

-- Audit log for admin mass-notification sends (per-recipient email delivery is
-- already logged in email_logs; this is the batch-level summary).
CREATE TABLE IF NOT EXISTS mass_notification_logs (
  id BIGSERIAL PRIMARY KEY,
  sent_by UUID REFERENCES profiles(id),
  subject TEXT NOT NULL,
  recipient_count INT NOT NULL DEFAULT 0,
  all_users BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE mass_notification_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage mass notification logs" ON mass_notification_logs;
CREATE POLICY "Admins manage mass notification logs" ON mass_notification_logs
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));
