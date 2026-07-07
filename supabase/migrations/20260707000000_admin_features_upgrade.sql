-- public/migrations/20260707000000_admin_features_upgrade.sql

-- 1. Add scheduled_at to final_deliverables
ALTER TABLE public.final_deliverables ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ;

-- 2. Add permalink to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS permalink TEXT UNIQUE;

-- 3. Create conversations table
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant1_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  participant2_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  last_message_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (participant1_id, participant2_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_support ON public.conversations (participant1_id) WHERE participant2_id IS NULL;

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage their own conversations" ON public.conversations;
CREATE POLICY "Users manage their own conversations" ON public.conversations
  FOR ALL USING (
    auth.uid() = participant1_id 
    OR auth.uid() = participant2_id 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 4. Create messages table
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage messages in their conversations" ON public.messages;
CREATE POLICY "Users manage messages in their conversations" ON public.messages
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.conversations c 
      WHERE c.id = conversation_id AND (auth.uid() = c.participant1_id OR auth.uid() = c.participant2_id)
    ) 
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true)
  );

-- 5. Create affiliate_settings table
CREATE TABLE IF NOT EXISTS public.affiliate_settings (
  key TEXT PRIMARY KEY,
  commission_percent NUMERIC NOT NULL DEFAULT 10,
  min_withdrawal NUMERIC NOT NULL DEFAULT 1000,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.affiliate_settings (key, commission_percent, min_withdrawal)
VALUES ('default', 10, 1000)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.affiliate_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read affiliate settings" ON public.affiliate_settings;
CREATE POLICY "Anyone can read affiliate settings" ON public.affiliate_settings FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage affiliate settings" ON public.affiliate_settings;
CREATE POLICY "Admins manage affiliate settings" ON public.affiliate_settings FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- 6. Create referrals table
CREATE TABLE IF NOT EXISTS public.referrals (
  id BIGSERIAL PRIMARY KEY,
  referrer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  referred_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  order_id BIGINT REFERENCES public.orders(id) ON DELETE SET NULL,
  commission_earned NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'completed',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (referrer_id, referred_id, order_id)
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Referrers can read own referrals" ON public.referrals;
CREATE POLICY "Referrers can read own referrals" ON public.referrals FOR SELECT USING (auth.uid() = referrer_id);

DROP POLICY IF EXISTS "Admins manage referrals" ON public.referrals;
CREATE POLICY "Admins manage referrals" ON public.referrals FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- 7. Create withdrawals table
CREATE TABLE IF NOT EXISTS public.withdrawals (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL,
  bank_details JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ DEFAULT now(),
  processed_at TIMESTAMPTZ
);

ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own withdrawals" ON public.withdrawals;
CREATE POLICY "Users manage own withdrawals" ON public.withdrawals FOR ALL USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins manage withdrawals" ON public.withdrawals;
CREATE POLICY "Admins manage withdrawals" ON public.withdrawals FOR ALL USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true));

-- 8. Trigger for auto-publishing completed deliverables
CREATE OR REPLACE FUNCTION public.auto_publish_deliverable_to_catalogue()
RETURNS TRIGGER AS $$
DECLARE
  v_order_topic TEXT;
  v_order_info TEXT;
  v_clean_title TEXT;
  v_department TEXT := 'General';
  v_level TEXT := 'BSc';
  v_price NUMERIC := 3000;
  v_exists BOOLEAN;
BEGIN
  SELECT topic, additional_info INTO v_order_topic, v_order_info
  FROM public.orders
  WHERE order_id = NEW.order_id;

  IF v_order_topic IS NOT NULL THEN
    v_clean_title := regexp_replace(v_order_topic, '^\[PROJECT\]\s*', '', 'i');
    
    IF v_order_info IS NOT NULL THEN
      IF v_order_info ~ 'Department:\s*([^\n]+)' THEN
        v_department := trim(substring(v_order_info from 'Department:\s*([^\n]+)'));
      END IF;
      IF v_order_info ~ 'Level:\s*([^\n]+)' THEN
        v_level := trim(substring(v_order_info from 'Level:\s*([^\n]+)'));
      END IF;
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM public.project_topics
      WHERE lower(title) = lower(v_clean_title) OR material_file_path = NEW.file_path
    ) INTO v_exists;

    IF NOT v_exists THEN
      INSERT INTO public.project_topics (title, department, level, price, material_file_path, is_active, description)
      VALUES (v_clean_title, v_department, v_level, v_price, NEW.file_path, true, 'Auto-published completed research project.');
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_auto_publish_deliverable ON public.final_deliverables;
CREATE TRIGGER trg_auto_publish_deliverable
AFTER INSERT ON public.final_deliverables
FOR EACH ROW
EXECUTE FUNCTION public.auto_publish_deliverable_to_catalogue();

-- 11. Notify admins on user registration trigger
CREATE OR REPLACE FUNCTION public.notify_admin_on_registration()
RETURNS TRIGGER AS $$
DECLARE
  v_admin_id UUID;
  v_email TEXT;
BEGIN
  -- Resolve email from auth.users
  SELECT email INTO v_email FROM auth.users WHERE id = NEW.id;
  
  -- Insert a notification for all admins
  FOR v_admin_id IN (SELECT id FROM public.profiles WHERE is_admin = true) LOOP
    INSERT INTO public.notifications (
      user_id,
      title,
      message,
      type,
      send_email,
      send_in_app
    ) VALUES (
      v_admin_id,
      'New User Registered',
      COALESCE(NEW.full_name, 'New User') || ' (' || COALESCE(v_email, 'OAuth User') || ') has registered.',
      'system',
      true,
      true
    );
  END LOOP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_profile_created_notify_admins ON public.profiles;
CREATE TRIGGER on_profile_created_notify_admins
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_admin_on_registration();
