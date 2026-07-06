-- Allow users to insert their own profile
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles 
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Create profile, notification preferences, and wallet on user signup automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into profiles if not exists
  INSERT INTO public.profiles (id, full_name, is_admin)
  VALUES (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    (new.email = 'yourwriterofficial@gmail.com')
  )
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name;

  -- Insert into notification_preferences
  INSERT INTO public.notification_preferences (
    user_id,
    email_order_updates, email_payments, email_vault_delivery, email_admin_messages, email_promotions,
    push_order_updates, push_payments, push_vault_delivery, push_admin_messages, push_promotions
  )
  VALUES (
    new.id,
    true, true, true, true, false,
    true, true, true, true, false
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Insert into wallets
  INSERT INTO public.wallets (user_id, balance)
  VALUES (new.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger the function on auth.users insert
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill existing profiles with default preferences and wallets if they are missing
INSERT INTO public.notification_preferences (
  user_id,
  email_order_updates, email_payments, email_vault_delivery, email_admin_messages, email_promotions,
  push_order_updates, push_payments, push_vault_delivery, push_admin_messages, push_promotions
)
SELECT 
  id,
  true, true, true, true, false,
  true, true, true, true, false
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;

INSERT INTO public.wallets (user_id, balance)
SELECT id, 0
FROM public.profiles
ON CONFLICT (user_id) DO NOTHING;
