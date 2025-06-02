-- Migration number: 0006    2025-06-02T00:00:02.000Z
DROP TABLE IF EXISTS videos;

CREATE TABLE videos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    youtube_video_id VARCHAR(20) NOT NULL UNIQUE,
    search_term_id INTEGER,
    title TEXT NOT NULL,
    description TEXT,
    thumbnail_url TEXT,
    channel_id VARCHAR(50),
    channel_title TEXT,
    published_at TIMESTAMP,
    processing_status VARCHAR(50) NOT NULL DEFAULT 'Pending Subtitle Processing',
    last_processed_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (search_term_id) REFERENCES search_terms(id) ON DELETE SET NULL,
    CHECK (processing_status IN ('Pending Subtitle Processing', 'Processing Subtitles', 'Subtitles Processed', 'Error - No Subtitles', 'Error - Processing Failed'))
);

-- Create indexes for performance
CREATE INDEX idx_videos_youtube_video_id ON videos(youtube_video_id);
CREATE INDEX idx_videos_search_term_id ON videos(search_term_id);
CREATE INDEX idx_videos_processing_status ON videos(processing_status);
CREATE INDEX idx_videos_published_at ON videos(published_at);

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_videos_updated_at 
    AFTER UPDATE ON videos
    BEGIN
        UPDATE videos 
        SET updated_at = CURRENT_TIMESTAMP
        WHERE id = NEW.id;
    END;
