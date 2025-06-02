import { WorkflowEntrypoint, WorkflowStep } from "cloudflare:workers";
import type { WorkflowEvent } from "cloudflare:workers";

type Env = {
  VIDEO_DISCOVERY_WORKFLOW: WorkflowEntrypoint<Env, Params>;
  SUBTITLE_PROCESSING_WORKFLOW: WorkflowEntrypoint<any, any>;
  DB: D1Database;
  YOUTUBE_API_KEY?: string;
};

type Params = {
  searchTermId: number;
  searchTerm: string;
};

type YouTubeVideo = {
  id: string;
  title: string;
  description: string;
  thumbnails: {
    default: { url: string };
    medium: { url: string };
    high: { url: string };
  };
  channelId: string;
  channelTitle: string;
  publishedAt: string;
};

export class VideoDiscoveryWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { DB, YOUTUBE_API_KEY } = this.env;
    const { searchTermId, searchTerm } = event.payload;

    // Update search term status to "Discovering Videos"
    await step.do("update status to discovering", async () => {
      await DB.prepare(`
        UPDATE search_terms 
        SET status = 'Discovering Videos', last_discovery_run_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(searchTermId).run();
    });
    // Discover YouTube videos
    const videos = await step.do("discover youtube videos", async () => {
      if (!YOUTUBE_API_KEY) {
        const error = 'YouTube API key not configured in environment variables';
        console.error(error);
        await DB.prepare(`
          UPDATE search_terms 
          SET status = 'Error', error_message = ?
          WHERE id = ?
        `).bind(error, searchTermId).run();
        throw new Error(error);
      }

      try {
        const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&q=${encodeURIComponent(searchTerm)}&maxResults=20&key=${YOUTUBE_API_KEY}`;
        
        console.log(`Searching YouTube for: "${searchTerm}"`);
        const response = await fetch(searchUrl);
        
        if (!response.ok) {
          let errorDetails = '';
          try {
            const errorData = await response.json();
            errorDetails = errorData.error?.message || `HTTP ${response.status}`;
            
            // Handle specific YouTube API errors
            if (response.status === 403) {
              if (errorDetails.includes('quota')) {
                errorDetails = `YouTube API quota exceeded. Please wait or upgrade your quota. Details: ${errorDetails}`;
              } else if (errorDetails.includes('API key')) {
                errorDetails = `Invalid YouTube API key. Please check your API key configuration. Details: ${errorDetails}`;
              } else {
                errorDetails = `YouTube API access forbidden. Details: ${errorDetails}`;
              }
            } else if (response.status === 400) {
              errorDetails = `Invalid search query or request format. Details: ${errorDetails}`;
            } else {
              errorDetails = `YouTube API error (${response.status}): ${errorDetails}`;
            }
          } catch (jsonError) {
            // If we can't parse the error response
            errorDetails = `YouTube API error ${response.status}: ${response.statusText}`;
          }
          
          console.error(errorDetails);
          await DB.prepare(`
            UPDATE search_terms 
            SET status = 'Error', error_message = ?
            WHERE id = ?
          `).bind(errorDetails, searchTermId).run();
          throw new Error(errorDetails);
        }

        const data = await response.json();
        console.log(`Found ${data.items?.length || 0} videos for "${searchTerm}"`);
        
        if (!data.items || data.items.length === 0) {
          const errorMessage = `No videos found for search term "${searchTerm}". Try a different search term or check if the term is too specific.`;
          console.warn(errorMessage);
          await DB.prepare(`
            UPDATE search_terms 
            SET status = 'Error', error_message = ?
            WHERE id = ?
          `).bind(errorMessage, searchTermId).run();
          throw new Error(errorMessage);
        }
        
        return data.items;
      } catch (error) {
        const errorMessage = error.message || 'Unknown error during YouTube API request';
        console.error('Error fetching from YouTube API:', errorMessage);
        await DB.prepare(`
          UPDATE search_terms 
          SET status = 'Error', error_message = ?
          WHERE id = ?
        `).bind(errorMessage, searchTermId).run();
        throw error;
      }
    });

    // Process and save videos to database
    const savedVideos = await step.do("save videos to database", async () => {
      const savedCount = [];
      
      for (const video of videos) {
        try {
          const videoData = video.snippet;
          
          // Check if video already exists
          const existingVideo = await DB.prepare(`
            SELECT id FROM videos WHERE youtube_video_id = ?
          `).bind(video.id.videoId).first();

          if (!existingVideo) {
            const result = await DB.prepare(`
              INSERT INTO videos (
                youtube_video_id, search_term_id, title, description, 
                thumbnail_url, channel_id, channel_title, published_at,
                processing_status
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Pending Subtitle Processing')
            `).bind(
              video.id.videoId,
              searchTermId,
              videoData.title,
              videoData.description || '',
              videoData.thumbnails?.medium?.url || videoData.thumbnails?.default?.url || '',
              videoData.channelId,
              videoData.channelTitle,
              videoData.publishedAt
            ).run();

            if (result.success) {
              savedCount.push(video.id.videoId);
            }
          }
        } catch (error) {
          console.error(`Error saving video ${video.id.videoId}:`, error);
        }
      }
      
      return savedCount;
    });

    // Trigger subtitle processing for each new video
    const subtitleWorkflowIds = await step.do("trigger subtitle processing", async () => {
      const { SUBTITLE_PROCESSING_WORKFLOW } = this.env;
      const workflowIds = [];
      
      if (SUBTITLE_PROCESSING_WORKFLOW && savedVideos.length > 0) {
        // Get video details for subtitle processing
        for (const youtubeVideoId of savedVideos) {
          try {
            const video = await DB.prepare(`
              SELECT id, youtube_video_id FROM videos WHERE youtube_video_id = ?
            `).bind(youtubeVideoId).first();
            
            if (video) {
              const workflowId = `subtitle-${video.id}-${Date.now()}`;
              const instance = await SUBTITLE_PROCESSING_WORKFLOW.create({
                id: workflowId,
                params: {
                  videoId: video.id,
                  youtubeVideoId: video.youtube_video_id
                }
              });
              workflowIds.push(workflowId);
              console.log(`Started subtitle processing for video ${video.youtube_video_id}`);
            }
          } catch (error) {
            console.error(`Failed to start subtitle processing for ${youtubeVideoId}:`, error);
          }
        }
      }
      
      return workflowIds;
    });

    // Update search term status to complete
    await step.do("update status to complete", async () => {
      const status = savedVideos.length > 0 ? 'Active' : 'Error';
      await DB.prepare(`
        UPDATE search_terms 
        SET status = ?
        WHERE id = ?
      `).bind(status, searchTermId).run();
    });

    // Log results
    await step.do("log results", async () => {
      console.log(`Discovery completed for "${searchTerm}": ${savedVideos.length} new videos saved`);
      console.log('Video IDs:', savedVideos);
      console.log('Subtitle workflows started:', subtitleWorkflowIds.length);
    });

    return {
      searchTermId,
      searchTerm,
      videosFound: videos.length,
      videosSaved: savedVideos.length,
      videoIds: savedVideos,
      subtitleWorkflowsTriggered: subtitleWorkflowIds.length
    };
  }
}