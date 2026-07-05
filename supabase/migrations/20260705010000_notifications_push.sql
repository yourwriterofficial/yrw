-- Unified notification infrastructure: in-app notifications, push subscriptions,
-- and per-user notification preferences (email + push, per category).

-- ── notifications ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'order_update' | 'payment' | 'vault_delivery' | 'admin_message' | 'promotion' | 'system'
  read BOOLEAN NOT NULL DEFAULT false,
  link TEXT,
  order_id BIGINT REFERENCES orders(id) ON DELETE SET NULL,
  send_email BOOLEAN NOT NULL DEFAULT false,
  send_in_app BOOLEAN NOT NULL DEFAULT true,
  is_admin_sent BOOLEAN NOT NULL DEFAULT false,
  batch_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications" ON notifications
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications" ON notifications
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can do everything on notifications" ON notifications;
CREATE POLICY "Admins can do everything on notifications" ON notifications
  FOR ALL USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ));

-- ── push_subscriptions ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, endpoint)
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own push subscriptions" ON push_subscriptions;
CREATE POLICY "Users manage their own push subscriptions" ON push_subscriptions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all push subscriptions" ON push_subscriptions;
CREATE POLICY "Admins can view all push subscriptions" ON push_subscriptions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ));

-- ── notification_preferences ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  email_order_updates BOOLEAN NOT NULL DEFAULT true,
  email_payments BOOLEAN NOT NULL DEFAULT true,
  email_vault_delivery BOOLEAN NOT NULL DEFAULT true,
  email_admin_messages BOOLEAN NOT NULL DEFAULT true,
  email_promotions BOOLEAN NOT NULL DEFAULT false,
  push_order_updates BOOLEAN NOT NULL DEFAULT true,
  push_payments BOOLEAN NOT NULL DEFAULT true,
  push_vault_delivery BOOLEAN NOT NULL DEFAULT true,
  push_admin_messages BOOLEAN NOT NULL DEFAULT true,
  push_promotions BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own notification preferences" ON notification_preferences;
CREATE POLICY "Users manage their own notification preferences" ON notification_preferences
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all notification preferences" ON notification_preferences;
CREATE POLICY "Admins can view all notification preferences" ON notification_preferences
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true
  ));
