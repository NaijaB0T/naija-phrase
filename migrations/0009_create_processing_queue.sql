-- Migration number: 0009    2025-06-02T16:30:00.000Z
-- Add processing queue table for handling large subtitle sets without rate limits

CREATE TABLE IF NOT EXISTS processing_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_id INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    chunk_data TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP,
    FOREIGN KEY (video_id) REFERENCES videos(id) ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_processing_queue_video_id ON processing_queue(video_id);
CREATE INDEX IF NOT EXISTS idx_processing_queue_status ON processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_processing_queue_created_at ON processing_queue(created_at);

-- Add cleanup for old completed queue items
CREATE INDEX IF NOT EXISTS idx_processing_queue_cleanup ON processing_queue(status, processed_at);
