import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const { DB } = locals.runtime.env;
    const videoId = url.searchParams.get('videoId');
    
    if (!videoId) {
      return new Response(JSON.stringify({ error: 'Video ID required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get video processing status
    const video = await DB.prepare(`
      SELECT id, youtube_video_id, title, processing_status, error_message, 
             last_processed_at, created_at
      FROM videos 
      WHERE id = ?
    `).bind(videoId).first();

    if (!video) {
      return new Response(JSON.stringify({ error: 'Video not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get phrase count for this video
    const phraseCountResult = await DB.prepare(`
      SELECT COUNT(*) as count 
      FROM video_phrases 
      WHERE video_id = ?
    `).bind(videoId).first();

    const phraseCount = phraseCountResult?.count || 0;

    // Get queue status if applicable
    let queueStatus = null;
    try {
      const queueResult = await DB.prepare(`
        SELECT 
          COUNT(*) as total_chunks,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_chunks,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_chunks
        FROM processing_queue 
        WHERE video_id = ?
      `).bind(videoId).first();
      
      if (queueResult && queueResult.total_chunks > 0) {
        queueStatus = {
          total_chunks: queueResult.total_chunks,
          pending_chunks: queueResult.pending_chunks,
          completed_chunks: queueResult.completed_chunks,
          progress_percentage: queueResult.total_chunks > 0 ? 
            Math.round((queueResult.completed_chunks / queueResult.total_chunks) * 100) : 0
        };
      }
    } catch (error) {
      // Queue table might not exist yet, ignore
    }

    // Determine processing stage and progress
    let stage = 'unknown';
    let progress = 0;
    let isStuck = false;

    const now = new Date();
    const lastProcessed = video.last_processed_at ? new Date(video.last_processed_at) : null;
    const timeSinceLastUpdate = lastProcessed ? (now.getTime() - lastProcessed.getTime()) / 1000 / 60 : 0;

    switch (video.processing_status) {
      case 'Pending Subtitle Processing':
        stage = 'waiting';
        progress = 0;
        break;
      case 'Processing Subtitles':
        stage = 'fetching_subtitles';
        progress = 25;
        if (timeSinceLastUpdate > 10) {
          isStuck = true;
          stage = 'stuck_fetching';
        }
        break;
      case 'Partial Processing - Queue Pending':
        stage = 'queue_processing';
        progress = queueStatus ? queueStatus.progress_percentage : 50;
        if (timeSinceLastUpdate > 15) {
          isStuck = true;
          stage = 'stuck_queue';
        }
        break;
      case 'Subtitles Processed':
        stage = 'completed';
        progress = 100;
        break;
      case 'Error - No Subtitles':
        stage = 'error_no_subtitles';
        progress = 0;
        break;
      default:
        if (video.processing_status?.startsWith('Error')) {
          stage = 'error';
          progress = 0;
        } else if (video.processing_status?.startsWith('Partial Processing')) {
          stage = 'partial_retry_needed';
          progress = 75;
        }
    }

    // If we have phrases being indexed, we're likely in the bulk indexing stage
    if (video.processing_status === 'Processing Subtitles' && phraseCount > 0 && !queueStatus) {
      stage = 'indexing_phrases';
      progress = 75;
      
      if (timeSinceLastUpdate > 5) {
        isStuck = true;
        stage = 'stuck_indexing';
      }
    }

    const response = {
      video: {
        id: video.id,
        youtube_video_id: video.youtube_video_id,
        title: video.title,
        processing_status: video.processing_status,
        error_message: video.error_message
      },
      monitoring: {
        stage,
        progress,
        phraseCount,
        isStuck,
        timeSinceLastUpdate: Math.round(timeSinceLastUpdate),
        queueStatus
      },
      timestamp: new Date().toISOString()
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' }
    });

  } catch (error) {
    console.error('Error getting worker status:', error);
    return new Response(JSON.stringify({ error: 'Failed to get worker status' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
