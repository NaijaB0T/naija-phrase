import { WorkflowEntrypoint, WorkflowStep } from "cloudflare:workers";
import type { WorkflowEvent } from "cloudflare:workers";

type Env = {
  SUBTITLE_PROCESSING_WORKFLOW: WorkflowEntrypoint<Env, Params>;
  DB: D1Database;
  YOUTUBE_API_KEY: string;
};

type Params = {
  videoId: number;
  youtubeVideoId: string;
};

interface SubtitleEntry {
  start: number;
  end: number;
  text: string;
}

export class SubtitleProcessingWorkflow extends WorkflowEntrypoint<Env, Params> {
  async run(event: WorkflowEvent<Params>, step: WorkflowStep) {
    const { DB } = this.env;
    const { videoId, youtubeVideoId } = event.payload;

    // Update video status to "Processing Subtitles"
    await step.do("update status to processing", async () => {
      await DB.prepare(`
        UPDATE videos 
        SET processing_status = 'Processing Subtitles', last_processed_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(videoId).run();
    });

    // Fetch subtitles from YouTube
    const subtitles = await step.do("fetch subtitles", async () => {
      try {
        console.log(`Fetching subtitles for video: ${youtubeVideoId}`);
        const subtitleData = await this.fetchYouTubeSubtitles(youtubeVideoId);
        
        if (subtitleData && subtitleData.length > 0) {
          console.log(`Found ${subtitleData.length} subtitle entries for ${youtubeVideoId}`);
          return subtitleData;
        } else {
          console.log(`No subtitles found for ${youtubeVideoId}`);
          return null;
        }
        
      } catch (error: unknown) {
        console.error(`Error fetching subtitles for ${youtubeVideoId}:`, error);
        let errorMessage = 'Failed to fetch subtitles';
        if (error instanceof Error) {
          errorMessage = `Subtitle fetch error: ${error.message}`;
        }
        
        await DB.prepare(`
          UPDATE videos 
          SET processing_status = 'Error - No Subtitles', error_message = ?
          WHERE id = ?
        `).bind(errorMessage, videoId).run();
        return null;
      }
    });

    if (!subtitles || subtitles.length === 0) {
      await step.do("mark as no subtitles", async () => {
        await DB.prepare(`
          UPDATE videos 
          SET processing_status = 'Error - No Subtitles',
              error_message = 'No auto-generated or manual subtitles available for this video'
          WHERE id = ?
        `).bind(videoId).run();
      });
      return { videoId, youtubeVideoId, status: 'no_subtitles', phrasesIndexed: 0 };
    }

    // IMPROVED: Clean, merge, and deduplicate subtitles with enhanced logic
    const processedSubtitles = await step.do("clean merge and deduplicate subtitles", async () => {
      return this.enhancedSubtitleProcessing(subtitles, videoId);
    });

    // Index phrases from processed subtitles
    const phrasesIndexed = await step.do("index phrases", async () => {
      let indexedCount = 0;
      
      for (const subtitle of processedSubtitles) {
        try {
          if (subtitle.text.trim().length > 0) {
            // IMPROVED: Additional check for existing similar phrases before insertion
            const exists = await this.checkForSimilarPhrase(DB, videoId, subtitle.text, subtitle.start);
            
            if (!exists) {
              await DB.prepare(`
                INSERT INTO video_phrases (video_id, phrase_text, start_time_seconds, end_time_seconds)
                VALUES (?, ?, ?, ?)
              `).bind(videoId, subtitle.text, subtitle.start, subtitle.end).run();
              indexedCount++;
            } else {
              console.log(`Skipping duplicate phrase: "${subtitle.text}" at ${subtitle.start}s`);
            }
          }
        } catch (error: unknown) {
          console.error(`Error indexing phrase:`, error);
        }
      }
      
      return indexedCount;
    });

    // Mark video as "Subtitles Processed"
    await step.do("mark as completed", async () => {
      await DB.prepare(`
        UPDATE videos 
        SET processing_status = 'Subtitles Processed'
        WHERE id = ?
      `).bind(videoId).run();
    });

    return {
      videoId,
      youtubeVideoId,
      status: 'completed',
      phrasesIndexed
    };
  }

  // IMPROVED: Enhanced subtitle processing with better duplicate detection
  private enhancedSubtitleProcessing(subtitles: SubtitleEntry[], videoId: number): SubtitleEntry[] {
    console.log(`Starting enhanced processing for ${subtitles.length} subtitles`);
    
    // Step 1: Apply initial cleaning and sort
    const cleanedSubtitles = subtitles
      .map(sub => ({
        ...sub,
        text: this.enhancedCleanText(sub.text)
      }))
      .filter(sub => sub.text.trim().length > 0)
      .sort((a, b) => {
        if (a.start !== b.start) return a.start - b.start;
        return a.end - b.end;
      });

    console.log(`After cleaning: ${cleanedSubtitles.length} subtitles`);

    // Step 2: Enhanced merging with better AI caption detection
    const mergedSubtitles = this.enhancedMergeSubtitles(cleanedSubtitles);
    console.log(`After merging: ${mergedSubtitles.length} subtitles`);

    // Step 3: Final deduplication pass
    const deduplicatedSubtitles = this.finalDeduplication(mergedSubtitles);
    console.log(`After deduplication: ${deduplicatedSubtitles.length} subtitles`);

    return deduplicatedSubtitles;
  }
