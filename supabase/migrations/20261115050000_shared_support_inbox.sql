-- One shared support inbox for developa.me and YourResearchWriter.
-- Every mailbox belongs to a brand, so each message is clearly "for Developa" or "for YourResearchWriter".
-- Server-only tables (RLS on, no policies): the app reads and writes them with the service role from admin-checked routes.
-- Purely additive; safe to run more than once.

CREATE TABLE IF NOT EXISTS public.inbox_mailboxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address text NOT NULL UNIQUE,
  display_name text NOT NULL,
  brand text NOT NULL CHECK (brand IN ('developa', 'yourwriter')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.inbox_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ref_code text NOT NULL UNIQUE,                 -- short code that appears in subjects, e.g. T-4F7A9C, so replies find their thread
  mailbox_id uuid NOT NULL REFERENCES public.inbox_mailboxes(id) ON DELETE CASCADE,
  brand text NOT NULL CHECK (brand IN ('developa', 'yourwriter')),
  subject text NOT NULL DEFAULT '(No subject)',
  customer_email text NOT NULL,
  customer_name text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'pending', 'resolved', 'spam')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
  assigned_to text,
  starred boolean NOT NULL DEFAULT false,
  unread boolean NOT NULL DEFAULT true,
  first_response_at timestamptz,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inbox_threads_brand_status_idx ON public.inbox_threads (brand, status, last_message_at DESC);
CREATE INDEX IF NOT EXISTS inbox_threads_customer_idx ON public.inbox_threads (customer_email);
CREATE INDEX IF NOT EXISTS inbox_threads_assigned_idx ON public.inbox_threads (assigned_to);

CREATE TABLE IF NOT EXISTS public.inbox_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.inbox_threads(id) ON DELETE CASCADE,
  mailbox_id uuid NOT NULL REFERENCES public.inbox_mailboxes(id) ON DELETE CASCADE,
  direction text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  from_address text NOT NULL,
  from_name text,
  to_addresses text[] NOT NULL DEFAULT '{}',
  cc_addresses text[] NOT NULL DEFAULT '{}',
  subject text NOT NULL DEFAULT '',
  body_text text,
  body_html text,
  message_id_header text,
  in_reply_to_header text,
  provider_id text,
  sent_by text,                                    -- the admin who sent an outbound message
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inbox_messages_thread_idx ON public.inbox_messages (thread_id, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS inbox_messages_msgid_idx ON public.inbox_messages (message_id_header) WHERE message_id_header IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.inbox_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.inbox_threads(id) ON DELETE CASCADE,
  author_email text NOT NULL,
  author_name text,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS inbox_notes_thread_idx ON public.inbox_notes (thread_id, created_at);

CREATE TABLE IF NOT EXISTS public.inbox_macros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  subject text,
  body text NOT NULL,
  brand text CHECK (brand IS NULL OR brand IN ('developa', 'yourwriter')),   -- NULL means both
  category text NOT NULL DEFAULT 'General',
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.inbox_mailboxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_macros ENABLE ROW LEVEL SECURITY;

-- The one address already in use. Developa's address is added from the inbox screen (Mailboxes), or is created
-- automatically the first time a message arrives for an @developa.me address.
INSERT INTO public.inbox_mailboxes (address, display_name, brand)
VALUES ('inbox@yourresearchwriter.com.ng', 'YourResearchWriter', 'yourwriter')
ON CONFLICT (address) DO NOTHING;

-- A few replies to start with. {{name}} is filled in with the customer's name.
INSERT INTO public.inbox_macros (title, subject, body, brand, category)
SELECT * FROM (VALUES
  ('Thanks, we are looking into it', NULL::text, E'Hello {{name}},\n\nThank you for writing to us. We have your message and are looking into it. We will reply as soon as we have an answer.\n\nBest regards,\nThe team', NULL::text, 'General'),
  ('Payment confirmed', 'Your payment is confirmed', E'Hello {{name}},\n\nWe have confirmed your payment and everything is now active on your account.\n\nIf anything looks wrong, just reply to this email.\n\nBest regards,\nThe team', NULL::text, 'Billing'),
  ('Developa: store is live', 'Your store is live', E'Hello {{name}},\n\nGood news: your site is live and ready for visitors. Share your link and add a few products or posts to get started.\n\nBest regards,\nThe Developa team', 'developa', 'Developa'),
  ('Developa: site limited', 'About your Developa site', E'Hello {{name}},\n\nWe had to limit some features on your site. The reason is shown on your dashboard. If you think this is a mistake, reply here and we will review it.\n\nBest regards,\nThe Developa team', 'developa', 'Developa'),
  ('YourResearchWriter: order update', 'An update on your order', E'Hello {{name}},\n\nHere is an update on your order. Please reply with any questions and we will help right away.\n\nBest regards,\nThe YourResearchWriter team', 'yourwriter', 'Orders')
) AS v(title, subject, body, brand, category)
WHERE NOT EXISTS (SELECT 1 FROM public.inbox_macros);
