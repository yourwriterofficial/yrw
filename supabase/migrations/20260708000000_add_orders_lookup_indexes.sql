-- orders is filtered by client_id and email (via .or() lookups) on nearly
-- every authenticated page load — see app/components/OrderAssistant.tsx,
-- app/dashboard/client/layout.tsx, app/dashboard/client/page.tsx, and
-- app/api/client/vault-files/route.ts — but had no supporting index, forcing
-- a full table scan per call. guest_email is looked up the same way for
-- guest/unauthenticated order tracking.
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_guest_email ON orders(guest_email);
