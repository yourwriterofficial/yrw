-- Online (Paystack) store orders were being rejected at insert: the original check only allowed
-- 'manual_transfer' and 'pay_on_delivery'. Widen it. Purely additive: existing rows stay valid.
ALTER TABLE public.site_orders
  DROP CONSTRAINT IF EXISTS site_orders_payment_method_check;

ALTER TABLE public.site_orders
  ADD CONSTRAINT site_orders_payment_method_check
  CHECK (payment_method IN ('manual_transfer', 'pay_on_delivery', 'paystack'));
