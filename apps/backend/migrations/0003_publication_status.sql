ALTER TABLE publications
ADD COLUMN status TEXT NOT NULL DEFAULT 'published'
CHECK (status IN ('published', 'unpublished'));

