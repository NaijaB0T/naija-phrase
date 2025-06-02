import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { DB } = locals.runtime.env;
    const { videoId, action } = await request.json();
    
    if (action === 'reset_stuck') {
      // Reset videos stuck for more than 10 minutes
      const result = await DB.prepare(`
        UPDATE videos 
        SET processing_status = 'Pending Subtitle Processing',
            error_message = 'Reset due to stuck processing',
            last_processed_at = CURRENT_TIMESTAMP
        WHERE processing_status = 'Processing Subtitles' 
          AND datetime(last_processed_at) < datetime('now', '-10 minutes')
          ${videoId ? 'AND id = ?' : ''}
      `).bind(...(videoId ? [videoId] : [])).run();
      
      return new Response(JSON.stringify({ 
        success: true,
        message: `Reset ${result.changes} stuck videos`,
        reset_count: result.changes
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    if (action === 'clear_phrases' && videoId) {
      // Clear incomplete phrase data for specific video
      const result = await DB.prepare(`
        DELETE FROM video_phrases WHERE video_id = ?
      `).bind(videoId).run();
      
      return new Response(JSON.stringify({ 
        success: true,
        message: `Cleared ${result.changes} phrases for video ${videoId}`,
        cleared_count: result.changes
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }
    
    return new Response(JSON.stringify({ 
      error: 'Invalid action' 
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in recovery action:', error);
    return new Response(JSON.stringify({ 
      error: 'Recovery action failed' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
