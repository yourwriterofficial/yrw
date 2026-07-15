-- public/migrations/20260715000000_fix_vault_rls.sql

-- 1. Enable RLS on final_deliverables
ALTER TABLE public.final_deliverables ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies if they exist to avoid conflict
DROP POLICY IF EXISTS "Users can view final deliverables of their own orders" ON public.final_deliverables;
DROP POLICY IF EXISTS "Admins manage all final deliverables" ON public.final_deliverables;

-- 3. Create SELECT policy for final_deliverables
CREATE POLICY "Users can view final deliverables of their own orders" ON public.final_deliverables
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.order_id = final_deliverables.order_id
        AND (
          o.client_id = auth.uid()
          OR o.email = (SELECT email FROM auth.users WHERE id = auth.uid())
          OR o.guest_email = (SELECT email FROM auth.users WHERE id = auth.uid())
        )
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    )
  );

-- 4. Create ALL policy for admins on final_deliverables
CREATE POLICY "Admins manage all final deliverables" ON public.final_deliverables
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND is_admin = true
    )
  );

-- 5. Drop and recreate client orders SELECT policy to support matching the email column
DROP POLICY IF EXISTS "Clients can view own orders" ON public.orders;
CREATE POLICY "Clients can view own orders" ON public.orders FOR SELECT USING (
  auth.uid() = client_id 
  OR guest_email = (SELECT email FROM auth.users WHERE id = auth.uid())
  OR email = (SELECT email FROM auth.users WHERE id = auth.uid())
);
