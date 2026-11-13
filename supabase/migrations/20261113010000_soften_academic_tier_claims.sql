-- Tone down guarantee-style wording in the package cards on the order page.
--
-- The cards read their bullet text from service_pricing_tiers.features, so the
-- change has to be made in the database. This removes the "NN–NN% plagiarism-free"
-- promises (the terms already say results are not guaranteed, and the packages
-- still include the Plagiarism & AI reports) and replaces "Grade-A delivery with
-- intensive auditing" with a plain statement of what the tier actually gives.
--
-- Run once in the Supabase SQL editor. Re-running is harmless.

update service_pricing_tiers
set features = array_remove(
                 array_remove(
                   array_remove(
                     array_remove(features, '95–100% plagiarism-free guaranteed'),
                     '90–100% plagiarism-free level'),
                   '85–90% plagiarism-free level'),
                 '75–80% plagiarism-free level')
where service_category = 'ACADEMIC';

update service_pricing_tiers
set features = array_replace(features,
                 'Grade-A delivery with intensive auditing',
                 'Extra quality review before delivery')
where service_category = 'ACADEMIC';
