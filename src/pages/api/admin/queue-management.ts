import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ url, locals }) => {
  try {
    const { DB } = locals.runtime.env;
    const action = url.searchParams.get('action');
    const videoId = url.searchParams.get('videoId');
    
    if (action === 'queue_status') {
      // Get queue status for all videos or specific video
      const whereClause = videoId ? 'WHERE video_id = ?' : '';
      const params = videoId ? [videoId] : [];
      
      const queueStatus = await DB.prepare(`
        SELECT 
          video_id,
          COUNT(*) as total_chunks,
          SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_chunks,
          SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_chunks,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_chunks,
          MIN(created_at) as queue_started,
          MAX(processed_at) as last_processed
        FROM processing_queue 
        ${whereClause}
        GROUP BY video_id
        ORDER BY queue_started DESC
      `).bind(...params).all();
      
      return new Response(JSON.stringify({
        success: true,
        queue_status: queueStatus.results || []
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'cleanup_queue') {
      // Clean up old completed queue items
      const result = await DB.prepare(`
        DELETE FROM processing_queue 
        WHERE status IN ('completed', 'failed') 
        AND processed_at < datetime('now', '-2 hours')
      `).run();
      
      return new Response(JSON.stringify({
        success: true,
        message: `Cleaned up ${result.changes} old queue items`,
        cleaned: result.changes
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      error: 'Invalid action. Use: queue_status, cleanup_queue'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in queue management:', error);
    return new Response(JSON.stringify({
      error: 'Queue management failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { DB } = locals.runtime.env;
    const { action, videoId } = await request.json();
    
    if (action === 'reset_queue' && videoId) {
      // Reset failed queue items to pending for retry
      const result = await DB.prepare(`
        UPDATE processing_queue 
        SET status = 'pending', processed_at = NULL 
        WHERE video_id = ? AND status = 'failed'
      `).bind(videoId).run();
      
      return new Response(JSON.stringify({
        success: true,
        message: `Reset ${result.changes} failed queue items to pending`,
        reset: result.changes
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'clear_queue' && videoId) {
      // Clear all queue items for a video (for fresh restart)
      const result = await DB.prepare(`
        DELETE FROM processing_queue WHERE video_id = ?
      `).bind(videoId).run();
      
      return new Response(JSON.stringify({
        success: true,
        message: `Cleared all queue items for video ${videoId}`,
        cleared: result.changes
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({
      error: 'Invalid action. Use: reset_queue, clear_queue'
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in queue management:', error);
    return new Response(JSON.stringify({
      error: 'Queue management operation failed'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
