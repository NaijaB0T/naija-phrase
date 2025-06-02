-- Migration number: 0008    2025-06-02T00:00:04.000Z
-- Add error message column to search_terms table for better error reporting

ALTER TABLE search_terms ADD COLUMN error_message TEXT;

-- Add error message column to videos table as well
ALTER TABLE videos ADD COLUMN error_message TEXT;