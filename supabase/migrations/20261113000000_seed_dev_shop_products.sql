-- Starter catalogue for the developa.me script shop: the kinds of systems
-- Nigerian businesses, schools and startups ask for most.
--
-- Rows are inserted HIDDEN (is_active = false) because none has a source file yet,
-- and a buyer must never pay for something they cannot download. For each product:
-- Admin > Dev Shop > edit > upload the source zip (and previews) > tick "Visible in shop".
-- Prices are in naira and are suggestions; adjust freely in the admin.
-- Safe to re-run: existing slugs are skipped.

insert into dev_products (title, slug, category, description, tech_stack, price, preview_images, license_terms, is_active, sort_order)
select v.title, v.slug, v.category, v.description, v.tech_stack, v.price, '{}',
  'Single-project use license: you may use this script in one live project. Redistribution or resale of the source code itself is not permitted.',
  false, v.sort_order
from (values
  ('School Result & Portal System', 'school-result-portal', 'School Management',
   'Student records, continuous assessment and exam scores, automatic term results with grades and positions, printable report cards, and parent/student login for checking results online.',
   array['Laravel','MySQL','Bootstrap'], 45000, 10),
  ('CBT Exam Platform (JAMB/WAEC style)', 'cbt-exam-platform', 'School Management',
   'Computer-based test system with question banks, timed exams, random question order, auto-marking, instant results and an admin dashboard. Works for schools, tutorial centres and recruitment tests.',
   array['Next.js','Supabase','Tailwind'], 55000, 20),
  ('POS & Inventory Manager', 'pos-inventory-manager', 'Business',
   'Point-of-sale for shops and supermarkets: product catalogue, barcode search, stock levels, low-stock alerts, daily sales reports, multiple cashiers, and receipt printing. Handles cash, transfer and POS payments.',
   array['Laravel','Vue','MySQL'], 65000, 30),
  ('VTU Airtime & Data Reseller Portal', 'vtu-reseller-portal', 'Fintech',
   'Resell airtime, data bundles, cable TV and electricity tokens. Includes wallet funding, agent and customer price tiers, transaction history and admin reporting. Wire up your preferred VTU API provider.',
   array['PHP','MySQL','REST API'], 85000, 40),
  ('Paystack / Flutterwave E-commerce Store', 'naija-ecommerce-store', 'E-commerce',
   'Online store with product variants, cart, naira pricing, Paystack and Flutterwave checkout, delivery fees by state, order tracking and an admin panel. Mobile-first.',
   array['Next.js','Supabase','Paystack'], 70000, 50),
  ('Ajo / Cooperative Savings Manager', 'ajo-cooperative-manager', 'Fintech',
   'Run a thrift, esusu or cooperative society: member records, contribution schedules, loan requests and repayments, interest calculation, and monthly statements.',
   array['Laravel','MySQL'], 60000, 60),
  ('Church & Ministry Management System', 'church-management-system', 'Organisations',
   'Members and cell groups, attendance, tithes and offerings, events, SMS announcements, and giving reports for the finance team.',
   array['Laravel','MySQL','Bootstrap'], 40000, 70),
  ('Hospital & Clinic Management', 'hospital-clinic-management', 'Healthcare',
   'Patient records, appointments, doctor schedules, prescriptions, billing and a simple pharmacy stock module.',
   array['Laravel','Vue','MySQL'], 95000, 80),
  ('Real Estate Listings & Agent Portal', 'real-estate-listings', 'Real Estate',
   'Property listings with search by state, price and type, agent profiles, enquiry forms that go to WhatsApp, and an admin panel for approving listings.',
   array['Next.js','Supabase','Tailwind'], 50000, 90),
  ('Restaurant Ordering & Delivery App', 'restaurant-ordering-app', 'Food & Retail',
   'Menu with categories, cart, online payment or pay-on-delivery, kitchen order screen, rider assignment and order status updates over WhatsApp or SMS.',
   array['Next.js','Supabase','Paystack'], 55000, 100),
  ('Invoice & Receipt Generator for SMEs', 'sme-invoice-generator', 'Business',
   'Create branded invoices, quotes and receipts as PDF, record part-payments, track who owes you, and send reminders by email or WhatsApp link.',
   array['Next.js','PostgreSQL'], 30000, 110),
  ('Bulk SMS & WhatsApp Broadcast Panel', 'bulk-sms-panel', 'Marketing',
   'Upload contacts, create groups, schedule campaigns, see delivery reports, and sell SMS units to your own customers with a built-in wallet. Connect any Nigerian SMS gateway.',
   array['PHP','MySQL','REST API'], 45000, 120),
  ('Logistics & Dispatch Tracker', 'logistics-dispatch-tracker', 'Logistics',
   'Book deliveries, assign riders, track parcel status with a public tracking link, calculate fees by distance or zone, and report on rider earnings.',
   array['Laravel','Vue','MySQL'], 75000, 130),
  ('Landing Page Pack (10 templates)', 'landing-page-pack', 'Templates',
   'Ten responsive, fast-loading landing pages for Nigerian small businesses: salon, restaurant, school, church, event, real estate, fashion, consulting, clinic and portfolio. Pure HTML and Tailwind.',
   array['HTML','Tailwind CSS'], 15000, 140),
  ('Final Year Project Starter: Student Portal', 'student-portal-starter', 'School Management',
   'A clean, well-commented student information portal (registration, course management, results, announcements) built to be extended and defended as a final-year project.',
   array['PHP','MySQL','Bootstrap'], 25000, 150)
) as v(title, slug, category, description, tech_stack, price, sort_order)
where not exists (select 1 from dev_products p where p.slug = v.slug);
