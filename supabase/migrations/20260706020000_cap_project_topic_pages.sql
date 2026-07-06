-- Re-roll page counts only for topics that currently exceed the 40-page cap;
-- topics already at or under 40 (and the admin "New Topic" default) are untouched.
UPDATE project_topics
SET pages = floor(random() * 21 + 20)::int  -- random 20-40 page count
WHERE pages > 40;
