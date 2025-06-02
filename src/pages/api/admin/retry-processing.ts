import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { DB, SUBTITLE_PROCESSING_WORKFLOW } = locals.runtime.env;
    const { videoId, retryAll } = await request.json();
    
    let videosToRetry = [];
    
    if (retryAll) {
      // Include both Error videos and Partial Processing videos
      const errorVideos = await DB.prepare(`
        SELECT id, youtube_video_id FROM videos 
        WHERE (processing_status LIKE 'Error%' OR processing_status LIKE 'Partial Processing%') 
        ORDER BY created_at DESC LIMIT 20
      `).all();
      videosToRetry = errorVideos.results || [];
    } else if (videoId) {
      const video = await DB.prepare(`
        SELECT id, youtube_video_id FROM videos 
        WHERE id = ? AND (processing_status LIKE 'Error%' OR processing_status LIKE 'Partial Processing%')
      `).bind(videoId).first();
      if (video) videosToRetry = [video];
    }

    if (videosToRetry.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, message: 'No failed videos found to retry', retried: 0
      }), { status: 200, headers: { 'Content-Type': 'application/json' }});
    }

    const workflowIds = [];
    for (const video of videosToRetry) {
      try {
        // Reset video status
        await DB.prepare(`
          UPDATE videos SET processing_status = 'Pending Subtitle Processing',
          error_message = NULL, last_processed_at = CURRENT_TIMESTAMP WHERE id = ?
        `).bind(video.id).run();
        
        // Trigger processing
        if (SUBTITLE_PROCESSING_WORKFLOW) {
          const workflowId = `subtitle-retry-${video.id}-${Date.now()}`;
          await SUBTITLE_PROCESSING_WORKFLOW.create({
            id: workflowId,
            params: { videoId: video.id, youtubeVideoId: video.youtube_video_id }
          });
          workflowIds.push(workflowId);
          await DB.prepare('UPDATE videos SET processing_status = ? WHERE id = ?').bind('Processing Subtitles', video.id).run();
        }
      } catch (error) {
        console.error(`Failed to retry processing for video ${video.id}:`, error);
      }
    }

    return new Response(JSON.stringify({ 
      success: true, message: `Started retry processing for ${workflowIds.length} videos`, retried: workflowIds.length
    }), { status: 200, headers: { 'Content-Type': 'application/json' }});

  } catch (error) {
    console.error('Error retrying video processing:', error);
    return new Response(JSON.stringify({ error: 'Failed to retry video processing' }), { 
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
};