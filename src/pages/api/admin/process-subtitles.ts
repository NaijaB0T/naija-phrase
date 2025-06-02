import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { DB, SUBTITLE_PROCESSING_WORKFLOW } = locals.runtime.env;
    const { videoId, processAll } = await request.json();
    
    let videosToProcess = [];
    
    if (processAll) {
      // Get all videos that need subtitle processing
      const pendingVideos = await DB.prepare(`
        SELECT id, youtube_video_id 
        FROM videos 
        WHERE processing_status = 'Pending Subtitle Processing'
        ORDER BY created_at ASC
        LIMIT 10
      `).all();
      
      videosToProcess = pendingVideos.results || [];
    } else if (videoId) {
      // Get specific video
      const video = await DB.prepare(`
        SELECT id, youtube_video_id 
        FROM videos 
        WHERE id = ? AND processing_status = 'Pending Subtitle Processing'
      `).bind(videoId).first();
      
      if (video) {
        videosToProcess = [video];
      }
    }

    if (videosToProcess.length === 0) {
      return new Response(JSON.stringify({ 
        success: true,
        message: 'No videos need subtitle processing',
        processed: 0
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Trigger subtitle processing workflows
    const workflowIds = [];
    
    if (SUBTITLE_PROCESSING_WORKFLOW) {
      for (const video of videosToProcess) {
        try {
          const workflowId = `subtitle-${video.id}-${Date.now()}`;
          await SUBTITLE_PROCESSING_WORKFLOW.create({
            id: workflowId,
            params: {
              videoId: video.id,
              youtubeVideoId: video.youtube_video_id
            }
          });
          workflowIds.push(workflowId);
          
          // Update video status to indicate processing started
          await DB.prepare(`
            UPDATE videos 
            SET processing_status = 'Processing Subtitles',
                last_processed_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `).bind(video.id).run();
          
        } catch (error) {
          console.error(`Failed to start subtitle processing for video ${video.id}:`, error);
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: `Started subtitle processing for ${workflowIds.length} videos`,
      processed: workflowIds.length,
      workflowIds
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error triggering subtitle processing:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to trigger subtitle processing' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};