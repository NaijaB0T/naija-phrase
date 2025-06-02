-- Migration number: 0007    2025-06-02T00:00:03.000Z
DROP TABLE IF EXISTS video_phrases;

CREATE TABLE video_phrases (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL,
    phrase_text TEXT NOT NULL,
    start_time_seconds DECIMAL(10,3) NOT NULL,
    end_time_seconds DECIMAL(10,3),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE,
    UNIQUE(video_id, phrase_text, start_time_seconds)
);

-- Create indexes for performance - especially important for phrase search
CREATE INDEX idx_video_phrases_video_id ON video_phrases(video_id);
CREATE INDEX idx_video_phrases_start_time ON video_phrases(start_time_seconds);

-- Create Full-Text Search index for phrase_text (D1 uses SQLite FTS5)
CREATE VIRTUAL TABLE video_phrases_fts USING fts5(
    phrase_text, 
    video_id UNINDEXED,
    start_time_seconds UNINDEXED,
    content='video_phrases',
    content_rowid='id'
);

-- Create triggers to keep FTS index in sync
CREATE TRIGGER video_phrases_fts_insert AFTER INSERT ON video_phrases BEGIN
    INSERT INTO video_phrases_fts(rowid, phrase_text, video_id, start_time_seconds) 
    VALUES (new.id, new.phrase_text, new.video_id, new.start_time_seconds);
END;

CREATE TRIGGER video_phrases_fts_delete AFTER DELETE ON video_phrases BEGIN
    INSERT INTO video_phrases_fts(video_phrases_fts, rowid, phrase_text, video_id, start_time_seconds) 
    VALUES ('delete', old.id, old.phrase_text, old.video_id, old.start_time_seconds);
END;

CREATE TRIGGER video_phrases_fts_update AFTER UPDATE ON video_phrases BEGIN
    INSERT INTO video_phrases_fts(video_phrases_fts, rowid, phrase_text, video_id, start_time_seconds) 
    VALUES ('delete', old.id, old.phrase_text, old.video_id, old.start_time_seconds);
    INSERT INTO video_phrases_fts(rowid, phrase_text, video_id, start_time_seconds) 
    VALUES (new.id, new.phrase_text, new.video_id, new.start_time_seconds);
END;
