-- Migration to upgrade project topics page, pricing, and addons
CREATE TABLE IF NOT EXISTS project_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE project_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read project settings" ON project_settings;
CREATE POLICY "Anyone can read project settings" ON project_settings
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins manage project settings" ON project_settings;
CREATE POLICY "Admins manage project settings" ON project_settings
  FOR ALL USING (EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND is_admin = true));

-- Seed default settings
INSERT INTO project_settings (key, value) VALUES
('level_prices', '{"BSc": 3999, "MSc": 4500, "PhD": 10000}'::jsonb),
('department_prices', '{}'::jsonb),
('page_settings', '{
  "hero_title": "Project Topics & Research Materials",
  "hero_description": "Thousands of ready-made materials across every Nigerian department — full Chapters 1–5, in MS Word, delivered to your secure vault.",
  "features": ["📖 Chapters 1–5", "🕗 Working hours 8am–7pm", "⚡ 4-hour delivery"],
  "disclaimer_text": "Please note: these are ready-made materials — we do not check or guarantee plagiarism/similarity or AI-detection levels on them. Purchasing simply means the project will be delivered as-is. Need a plagiarism-free, AI-free custom write-up? Use our main writing service →",
  "checkout_terms": "I understand this is a ready-made material — similarity/plagiarism and AI-detection levels are not checked or guaranteed. My purchase means the project will be delivered (Chapters 1–5, MS Word) to my vault. Working hours are 8am–7pm; delivery is within 4 hours.",
  "show_random": true
}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- Add-ons table updates
ALTER TABLE project_addons ADD COLUMN IF NOT EXISTS price_type TEXT DEFAULT 'fixed';
ALTER TABLE project_addons ADD COLUMN IF NOT EXISTS features JSONB DEFAULT '[]'::jsonb;
ALTER TABLE project_addons ADD COLUMN IF NOT EXISTS is_location_changer BOOLEAN DEFAULT false;

-- Create get_project_topics_random RPC function
CREATE OR REPLACE FUNCTION get_project_topics_random(
  p_seed DOUBLE PRECISION,
  p_dept TEXT,
  p_level TEXT,
  p_search TEXT,
  p_limit INT,
  p_offset INT
) RETURNS TABLE (
  id BIGINT,
  title TEXT,
  department TEXT,
  description TEXT,
  pages INT,
  chapters TEXT,
  format TEXT,
  year INT,
  level TEXT,
  price NUMERIC,
  material_file_path TEXT,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  PERFORM setseed(p_seed);
  RETURN QUERY
  SELECT pt.id, pt.title, pt.department, pt.description, pt.pages, pt.chapters, pt.format, pt.year, pt.level, pt.price, pt.material_file_path, pt.is_active, pt.created_at, pt.updated_at
  FROM project_topics pt
  WHERE pt.is_active = true
    AND (p_dept = 'all' OR pt.department = p_dept)
    AND (p_level = 'all' OR pt.level = p_level)
    AND (p_search = '' OR pt.title ILIKE '%' || p_search || '%')
  ORDER BY random()
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION get_project_topics_random TO anon, authenticated;
