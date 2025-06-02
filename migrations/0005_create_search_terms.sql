-- Migration number: 0005    2025-06-02T00:00:01.000Z
DROP TABLE IF EXISTS search_terms;

CREATE TABLE search_terms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    term_text TEXT NOT NULL UNIQUE,
    admin_id INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'Pending Discovery',
    last_discovery_run_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE,
    CHECK (status IN ('Pending Discovery', 'Discovering Videos', 'Discovery Complete', 'Processing Subtitles', 'Active', 'Error'))
);

-- Create indexes for performance
CREATE INDEX idx_search_terms_status ON search_terms(status);
CREATE INDEX idx_search_terms_admin_id ON search_terms(admin_id);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_search_terms_updated_at 
    AFTER UPDATE ON search_terms
    BEGIN
        UPDATE search_terms 
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.id;
    END;
