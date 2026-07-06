-- Ready-made project material topics sold on /projects (chapters 4-5, ₦3,000 each by default).
CREATE TABLE IF NOT EXISTS project_topics (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  department TEXT NOT NULL,
  description TEXT,
  pages INT DEFAULT 0,
  chapters TEXT DEFAULT '4-5',
  format TEXT DEFAULT 'MS Word & PDF',
  year INT,
  price NUMERIC NOT NULL DEFAULT 3000,
  material_file_path TEXT,          -- optional: pre-uploaded deliverable for instant delivery
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_project_topics_dept ON project_topics(department);
CREATE INDEX IF NOT EXISTS idx_project_topics_active ON project_topics(is_active);

ALTER TABLE project_topics ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read active project topics" ON project_topics;
CREATE POLICY "Anyone can read active project topics" ON project_topics
  FOR SELECT USING (is_active = true OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

DROP POLICY IF EXISTS "Admins manage project topics" ON project_topics;
CREATE POLICY "Admins manage project topics" ON project_topics
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- (Seed rows for the initial corpus were inserted via the Supabase MCP at migration time.)
