import type { APIRoute } from 'astro';

function extractYouTubeVideoId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return match ? match[1] : null;
}

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { DB, SUBTITLE_PROCESSING_WORKFLOW, YOUTUBE_API_KEY } = locals.runtime.env;
    const { videoUrl } = await request.json();
    
    const videoId = extractYouTubeVideoId(videoUrl);
    if (!videoId) {
      return new Response(JSON.stringify({ error: 'Invalid YouTube URL' }), { status: 400, headers: { 'Content-Type': 'application/json' }});
    }

    // Check if exists
    const existing = await DB.prepare('SELECT id FROM videos WHERE youtube_video_id = ?').bind(videoId).first();
    if (existing) {
      return new Response(JSON.stringify({ error: 'Video already exists' }), { status: 409, headers: { 'Content-Type': 'application/json' }});
    }

    // Get video details
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${videoId}&key=${YOUTUBE_API_KEY}`);
    const data = await response.json();
    if (!data.items?.length) {
      return new Response(JSON.stringify({ error: 'Video not found' }), { status: 404, headers: { 'Content-Type': 'application/json' }});
    }

    const videoData = data.items[0].snippet;
    
    // Insert video
    const result = await DB.prepare(`
      INSERT INTO videos (youtube_video_id, title, description, thumbnail_url, channel_id, channel_title, published_at, processing_status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Pending Subtitle Processing') RETURNING id
    `).bind(
      videoId, videoData.title, videoData.description || '', 
      videoData.thumbnails?.medium?.url || '', videoData.channelId, 
      videoData.channelTitle, videoData.publishedAt
    ).first();

    // Trigger subtitle processing
    if (SUBTITLE_PROCESSING_WORKFLOW) {
      try {
        await SUBTITLE_PROCESSING_WORKFLOW.create({
          id: `subtitle-manual-${result.id}-${Date.now()}`,
          params: { videoId: result.id, youtubeVideoId: videoId }
        });
        await DB.prepare('UPDATE videos SET processing_status = ? WHERE id = ?').bind('Processing Subtitles', result.id).run();
      } catch (e) { console.error('Failed to start processing:', e); }
    }

    return new Response(JSON.stringify({ success: true, message: 'Video added successfully', videoId: result.id }), { 
      status: 201, headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Add video error:', error);
    return new Response(JSON.stringify({ error: 'Failed to add video' }), { status: 500, headers: { 'Content-Type': 'application/json' }});
  }
};