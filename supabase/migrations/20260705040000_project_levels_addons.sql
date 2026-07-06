-- Academic level + tiered pricing for project materials
ALTER TABLE project_topics ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT 'BSc';  -- 'BSc' | 'MSc' | 'PhD'
ALTER TABLE project_topics ALTER COLUMN chapters SET DEFAULT '1-5';
ALTER TABLE project_topics ALTER COLUMN format SET DEFAULT 'MS Word';

-- Optional add-ons a buyer can attach to a project purchase (admin-managed).
CREATE TABLE IF NOT EXISTS project_addons (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE project_addons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active project addons" ON project_addons;
CREATE POLICY "Anyone can read active project addons" ON project_addons
  FOR SELECT USING (is_active = true OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "Admins manage project addons" ON project_addons;
CREATE POLICY "Admins manage project addons" ON project_addons
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Lightweight department + count list for the /projects sidebar (avoids pulling 3000 rows).
CREATE OR REPLACE VIEW project_topic_departments AS
  SELECT department, count(*)::int AS count
  FROM project_topics
  WHERE is_active = true
  GROUP BY department
  ORDER BY department;

GRANT SELECT ON project_topic_departments TO anon, authenticated;

-- (12 default add-ons and 3,000 seeded topics with levels/tiered pricing were inserted at migration time.)
