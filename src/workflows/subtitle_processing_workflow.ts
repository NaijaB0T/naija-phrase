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
        
        // Try to get subtitles using the official YouTube Data API v3
        const subtitleData = await this.fetchYouTubeSubtitles(youtubeVideoId);
        
        if (subtitleData && subtitleData.length > 0) {
          console.log(`Found ${subtitleData.length} subtitle entries for ${youtubeVideoId}`);
          return subtitleData;
        } else {
          console.log(`No subtitles found for ${youtubeVideoId}`);
          return null;
        }
        
      } catch (error: unknown) { // Cast error to unknown
        console.error(`Error fetching subtitles for ${youtubeVideoId}:`, error);
        
        // Provide more detailed error message
        let errorMessage = 'Failed to fetch subtitles';
        if (error instanceof Error && error.message.includes('YouTube API error')) { // Check if error is an instance of Error
          errorMessage = `YouTube API error: ${error.message}`;
        } else if (error instanceof Error && error.message.includes('No captions available')) {
          errorMessage = 'No captions/subtitles available for this video';
        } else if (error instanceof Error && error.message.includes('API key')) {
          errorMessage = 'YouTube API key configuration error';
        } else if (error instanceof Error) { // General error message
          errorMessage = `Subtitle fetch error: ${error.message}`;
        } else {
          errorMessage = `An unknown error occurred during subtitle fetch.`;
        }
        
        // Update video with specific error message
        await DB.prepare(`
          UPDATE videos 
          SET processing_status = 'Error - No Subtitles',
              error_message = ?
          WHERE id = ?
        `).bind(errorMessage, videoId).run();
        
        return null;
      }
    });

    if (!subtitles || subtitles.length === 0) {
      // Mark video as "Error - No Subtitles" with detailed message
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

    // Apply initial cleaning to each subtitle text before merging
    const preCleanedSubtitles = subtitles.map(sub => ({
      ...sub,
      text: this.cleanText(sub.text) // Apply cleanText here
    }));

    // Clean and merge subtitles
    const cleanedSubtitles = await step.do("clean and merge subtitles", async () => {
      return this.cleanAndMergeSubtitles(preCleanedSubtitles); // Pass pre-cleaned subtitles
    });

    // OPTIMIZED: Bulk index phrases with single database transaction
    const phrasesIndexed = await step.do("bulk index phrases", async () => {
      if (cleanedSubtitles.length === 0) return 0;
      
      console.log(`Starting bulk processing of ${cleanedSubtitles.length} subtitle entries`);
      
      // Step 1: Get existing phrases for this video in one query
      const existingPhrasesResult = await DB.prepare(`
        SELECT phrase_text, start_time_seconds, end_time_seconds 
        FROM video_phrases 
        WHERE video_id = ?
      `).bind(videoId).all();
      
      const existingPhrases = existingPhrasesResult.results || [];
      console.log(`Found ${existingPhrases.length} existing phrases for comparison`);
      
      // Step 2: Filter out duplicates in memory (much faster)
      const uniqueSubtitles = this.bulkFilterDuplicates(cleanedSubtitles, existingPhrases);
      console.log(`After deduplication: ${uniqueSubtitles.length} unique phrases to insert`);
      
      if (uniqueSubtitles.length === 0) {
        console.log('No new unique phrases to insert');
        return 0;
      }
      
      // Step 3: Bulk insert using VALUES clause (single database call)
      const insertedCount = await this.bulkInsertPhrases(DB, videoId, uniqueSubtitles);
      console.log(`Successfully bulk inserted ${insertedCount} phrases`);
      
      return insertedCount;
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

  // Helper method to fetch YouTube subtitles using the official YouTube Data API v3
  private async fetchYouTubeSubtitles(videoId: string): Promise<SubtitleEntry[] | null> {
    try {
      const apiKey = this.env.YOUTUBE_API_KEY;
      if (!apiKey) {
        throw new Error('YouTube API key not configured');
      }

      console.log(`Fetching captions for video ${videoId} using YouTube Data API v3`);

      // Step 1: Get available caption tracks using YouTube Data API v3
      const captionsListUrl = `https://www.googleapis.com/youtube/v3/captions?part=snippet&videoId=${videoId}&key=${apiKey}`;
      
      const captionsResponse = await fetch(captionsListUrl);
      if (!captionsResponse.ok) {
        throw new Error(`YouTube API error: ${captionsResponse.status} - ${await captionsResponse.text()}`);
      }

      const captionsData: any = await captionsResponse.json(); // Cast to any
      
      if (!captionsData.items || captionsData.items.length === 0) {
        console.log(`No captions available for video ${videoId}`);
        return null;
      }

      // Step 2: Find the best caption track (prefer English, then auto-generated)
      let selectedCaption = null;
      
      // Priority order: English manual captions, then English auto-generated, then any auto-generated, then any caption
      const priorityOrder = [
        (item: any) => item.snippet.language === 'en' && item.snippet.trackKind !== 'ASR',
        (item: any) => item.snippet.language === 'en' && item.snippet.trackKind === 'ASR',
        (item: any) => item.snippet.trackKind === 'ASR',
        (item: any) => true
      ];

      for (const condition of priorityOrder) {
        selectedCaption = captionsData.items.find(condition);
        if (selectedCaption) break;
      }

      if (!selectedCaption) {
        console.log(`No suitable caption track found for video ${videoId}`);
        return null;
      }

      console.log(`Selected caption: ${selectedCaption.snippet.name} (${selectedCaption.snippet.language}, ${selectedCaption.snippet.trackKind})`);

      // Step 3: Download the caption content
      const captionDownloadUrl = `https://www.googleapis.com/youtube/v3/captions/${selectedCaption.id}?key=${apiKey}&tfmt=vtt`;
      
      const captionResponse = await fetch(captionDownloadUrl);
      if (!captionResponse.ok) {
        // If direct download fails, try alternative methods
        console.log(`Direct caption download failed, trying alternative methods for video ${videoId}`);
        return await this.fetchSubtitlesAlternative(videoId);
      }

      const vttContent = await captionResponse.text();
      if (!vttContent || !vttContent.includes('WEBVTT')) {
        console.log(`Invalid VTT content received for video ${videoId}`);
        return await this.fetchSubtitlesAlternative(videoId);
      }

      console.log(`Successfully fetched captions for video ${videoId} using YouTube Data API`);
      return this.parseVTT(vttContent);

    } catch (error: unknown) { // Cast error to unknown
      console.error(`YouTube Data API failed for video ${videoId}:`, error);
      
      // Fallback to alternative methods
      console.log(`Trying alternative subtitle fetch methods for video ${videoId}`);
      return await this.fetchSubtitlesAlternative(videoId);
    }
  }

  // Alternative method using the old approach as fallback
  private async fetchSubtitlesAlternative(videoId: string): Promise<SubtitleEntry[] | null> {
    try {
      console.log(`Using alternative subtitle fetch for video ${videoId}`);
      
      // Method 1: Try to get caption tracks from YouTube's player API
      const playerResponse = await this.getYouTubePlayerConfig(videoId);
      if (playerResponse && playerResponse.captions) {
        const captionTracks = playerResponse.captions.playerCaptionsTracklistRenderer?.captionTracks;
        if (captionTracks && captionTracks.length > 0) {
          // Find English captions (auto-generated or manual)
          const englishTrack = captionTracks.find((track: any) => 
            track.languageCode === 'en' || track.languageCode === 'en-US'
          ) || captionTracks[0]; // Fallback to first available track
          
          if (englishTrack && englishTrack.baseUrl) {
            console.log(`Found caption track for ${videoId}: ${englishTrack.name?.simpleText || 'Unknown'}`);
            return await this.fetchCaptionTrack(englishTrack.baseUrl);
          }
        }
      }
      
      // Method 2: Try direct timedtext API approach
      console.log(`Trying direct timedtext API for ${videoId}`);
      return await this.fetchDirectTimedText(videoId);
      
    } catch (error: unknown) { // Cast error to unknown
      console.error(`All alternative subtitle fetch methods failed for ${videoId}:`, error);
      return null;
    }
  }

  // Method to get YouTube player configuration
  private async getYouTubePlayerConfig(videoId: string): Promise<any> {
    try {
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const response = await fetch(watchUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
      });
      
      const html = await response.text();
      
      // Extract player config from the HTML
      const playerConfigMatch = html.match(/var ytInitialPlayerResponse = ({.*?});/);
      if (playerConfigMatch) {
        return JSON.parse(playerConfigMatch[1]);
      }
      
      return null;
    } catch (error: unknown) { // Cast error to unknown
      console.error(`Failed to get player config for ${videoId}:`, error);
      return null;
    }
  }

  // Method to fetch caption track content
  private async fetchCaptionTrack(baseUrl: string): Promise<SubtitleEntry[]> {
    try {
      // Add format parameter to get VTT format
      const vttUrl = baseUrl.includes('?') ? `${baseUrl}&fmt=vtt` : `${baseUrl}?fmt=vtt`;
      
      const response = await fetch(vttUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch captions: ${response.status}`);
      }
      
      const vttContent = await response.text();
      return this.parseVTT(vttContent);
    } catch (error: unknown) { // Cast error to unknown
      console.error('Failed to fetch caption track:', error);
      throw error;
    }
  }

  // Method to try direct timedtext API
  private async fetchDirectTimedText(videoId: string): Promise<SubtitleEntry[]> {
    const timedTextUrls = [
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en&fmt=vtt`,
      `https://www.youtube.com/api/timedtext?v=${videoId}&lang=en-US&fmt=vtt`,
      `https://www.youtube.com/api/timedtext?v=${videoId}&fmt=vtt`,
    ];

    for (const url of timedTextUrls) {
      try {
        console.log(`Trying timedtext URL: ${url}`);
        const response = await fetch(url);
        if (response.ok) {
          const vttContent = await response.text();
          if (vttContent && vttContent.includes('WEBVTT')) {
            console.log(`Successfully fetched timedtext for ${videoId}`);
            return this.parseVTT(vttContent);
          }
        }
      } catch (error: unknown) { // Cast error to unknown
        console.log(`Timedtext URL failed: ${url}`, error);
        continue;
      }
    }
    
    throw new Error('No working timedtext URLs found');
  }

  // Helper method to parse VTT subtitle format
  private parseVTT(vttText: string): SubtitleEntry[] {
    const lines = vttText.split('\n');
    const subtitles: SubtitleEntry[] = [];
    let currentEntry: Partial<SubtitleEntry> = {};
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Skip WEBVTT header and empty lines
      if (!line || line.startsWith('WEBVTT') || line.startsWith('NOTE') || line.startsWith('STYLE')) continue;
      
      // Time code line (e.g., "00:00:01.000 --> 00:00:03.000")
      if (line.includes('-->')) {
        const [startTime, endTime] = line.split('-->').map(t => t.trim());
        currentEntry.start = this.timeToSeconds(startTime);
        currentEntry.end = this.timeToSeconds(endTime);
      }
      // Text line
      else if (currentEntry.start !== undefined && currentEntry.end !== undefined) {
        currentEntry.text = line;
        subtitles.push(currentEntry as SubtitleEntry);
        currentEntry = {};
      }
    }
    
    return subtitles;
  }

  // Helper method to convert time format to seconds
  private timeToSeconds(timeStr: string): number {
    const parts = timeStr.split(':');
    if (parts.length === 3) {
      const hours = parseInt(parts[0]);
      const minutes = parseInt(parts[1]);
      const seconds = parseFloat(parts[2]);
      return hours * 3600 + minutes * 60 + seconds;
    } else if (parts.length === 2) {
      const minutes = parseInt(parts[0]);
      const seconds = parseFloat(parts[1]);
      return minutes * 60 + seconds;
    }
    return parseFloat(timeStr);
  }

  // Constants for subtitle cleaning - IMPROVED for AI captions
  private readonly TIME_LEEWAY_MS = 2000; // Up to 2 seconds gap allowed for merging AI captions (was 750)
  private readonly OVERLAP_WORD_COUNT = 3; // Max words to check for stitching overlap

  // Helper method to convert time string (HH:MM:SS.mmm) to milliseconds
  private timeStrToMs(timeStr: string): number {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    if (parts.length !== 3) return 0; // Basic validation

    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const secMsParts = parts[2].split('.');
    const seconds = parseInt(secMsParts[0], 10);
    const milliseconds = secMsParts.length > 1 ? parseInt(secMsParts[1], 10) : 0;

    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds) || isNaN(milliseconds)) {
        return 0; // Invalid format
    }
    return hours * 3600000 + minutes * 60000 + seconds * 1000 + milliseconds;
  }

  // Helper method to convert milliseconds to time string (HH:MM:SS.mmm)
  private msToTimeStr(totalMs: number): string {
    if (totalMs < 0) totalMs = 0;
    let hours = Math.floor(totalMs / 3600000);
    totalMs %= 3600000;
    let minutes = Math.floor(totalMs / 60000);
    totalMs %= 60000;
    let seconds = Math.floor(totalMs / 1000);
    let milliseconds = totalMs % 1000;

    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(milliseconds).padStart(3, '0')}`;
  }

  // Helper method for text merging logic - IMPROVED for AI captions
  private attemptTextMerge(textA: string, textB: string): string | null {
    const normA = (textA || "").trim();
    const normB = (textB || "").trim();

    if (!normA) return textB;
    if (!normB) return textA;

    const normALower = normA.toLowerCase();
    const normBLower = normB.toLowerCase();

    // 1. Progressive reveal: normB is an extension of normA
    if (normBLower.startsWith(normALower) && normB.length > normA.length) {
        return textB; // Use original textB for casing
    }

    // 2. Progressive reveal: normA is an extension of normB (normB is redundant)
    if (normALower.startsWith(normBLower) && normA.length >= normB.length) {
        return textA; // Use original textA
    }

    // 3. IMPROVED: Better similarity check for AI captions with punctuation variations
    const cleanA = normALower.replace(/[^\w\s]/g, '');
    const cleanB = normBLower.replace(/[^\w\s]/g, '');
    
    if (cleanA === cleanB && cleanA.length > 0) {
        // Same text with different punctuation - return longer version
        return textA.length >= textB.length ? textA : textB;
    }

    // 4. IMPROVED: Progressive reveal with punctuation tolerance
    if (cleanB.startsWith(cleanA) && cleanB.length > cleanA.length) {
        return textB;
    }
    if (cleanA.startsWith(cleanB) && cleanA.length > cleanB.length) {
        return textA;
    }

    // 5. Stitching: Last few words of normA are the first few words of normB
    const wordsA = textA.split(/\s+/); // Split by any whitespace
    const wordsB = textB.split(/\s+/);

    if (!wordsA.length || !wordsB.length) {
        return normA && normB ? `${textA} ${textB}` : (textA || textB);
    }
    
    // Helper to clean words for comparison (remove trailing punctuation)
    const cleanWord = (word: string) => word.toLowerCase().replace(/[.,?!]$/, '');

    for (let k = Math.min(wordsA.length, wordsB.length, this.OVERLAP_WORD_COUNT); k > 0; k--) {
        const suffixA = wordsA.slice(-k).map(cleanWord);
        const prefixB = wordsB.slice(0, k).map(cleanWord);

        if (suffixA.every((val, index) => val === prefixB[index])) {
            // Overlap found, append the non-overlapping part of textB
            return `${wordsA.join(" ")} ${wordsB.slice(k).join(" ")}`;
        }
    }
    return null; // No merge
  }

  // Main cleaning function adapted for SubtitleEntry[]
  private cleanAndMergeSubtitles(parsedSubs: SubtitleEntry[]): SubtitleEntry[] {
    if (parsedSubs.length === 0) {
      return [];
    }

    // Sort by begin time, then by end time (already done in run, but good for standalone)
    parsedSubs.sort((a, b) => {
        if (a.start !== b.start) {
            return a.start - b.start;
        }
        return a.end - b.end;
    });

    const cleanedSubs: SubtitleEntry[] = [];
    let currentSub = { ...parsedSubs[0] };

    for (let i = 1; i < parsedSubs.length; i++) {
        const nextSub = parsedSubs[i];
        let merged = false;

        // Convert to milliseconds for comparison with TIME_LEEWAY_MS
        const currentEndMs = currentSub.end * 1000;
        const nextBeginMs = nextSub.start * 1000;

        if (nextBeginMs <= currentEndMs + this.TIME_LEEWAY_MS) {
            const isCurrentSpecial = currentSub.text.startsWith('[') && currentSub.text.endsWith(']');
            const isNextSpecial = nextSub.text.startsWith('[') && nextSub.text.endsWith(']');

            if (isCurrentSpecial && isNextSpecial && currentSub.text === nextSub.text) {
                currentSub.end = Math.max(currentSub.end, nextSub.end);
                merged = true;
            } else if (!isCurrentSpecial && !isNextSpecial) {
                const mergedTextCandidate = this.attemptTextMerge(currentSub.text, nextSub.text);
                if (mergedTextCandidate !== null) {
                    currentSub.text = mergedTextCandidate;
                    currentSub.end = Math.max(currentSub.end, nextSub.end);
                    merged = true;
                }
            }
        }

        if (!merged) {
            cleanedSubs.push(currentSub);
            currentSub = { ...nextSub };
        }
    }
    cleanedSubs.push(currentSub); // Add the last processed subtitle

    return cleanedSubs;
  }

  // Helper method to clean subtitle text (existing method, kept for general cleaning)
  private cleanText(text: string): string {
    return text
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .replace(/&/g, '&')   // Fix HTML entities
      .replace(/&#39;/g, "'")   // Fix apostrophes
      .replace(/"/g, '"')  // Fix quotes
      .trim();
  }

  // OPTIMIZED: Bulk filter duplicates in memory instead of individual database calls
  private bulkFilterDuplicates(newSubtitles: SubtitleEntry[], existingPhrases: any[]): SubtitleEntry[] {
    const uniqueSubtitles: SubtitleEntry[] = [];
    
    // Create a fast lookup map for existing phrases
    const existingMap = new Map<string, Array<{start: number, end: number}>>();
    
    for (const existing of existingPhrases) {
      const normalizedText = this.normalizeForComparison(existing.phrase_text);
      if (!existingMap.has(normalizedText)) {
        existingMap.set(normalizedText, []);
      }
      existingMap.get(normalizedText)!.push({
        start: existing.start_time_seconds,
        end: existing.end_time_seconds
      });
    }
    
    // Check each new subtitle against existing ones
    for (const subtitle of newSubtitles) {
      const normalizedText = this.normalizeForComparison(subtitle.text);
      let isDuplicate = false;
      
      // Check exact normalized text matches
      if (existingMap.has(normalizedText)) {
        const matches = existingMap.get(normalizedText)!;
        for (const match of matches) {
          if (Math.abs(match.start - subtitle.start) < 2.0) { // Within 2 seconds
            isDuplicate = true;
            break;
          }
        }
      }
      
      // Check against other new subtitles being processed (avoid internal duplicates)
      if (!isDuplicate) {
        for (const other of uniqueSubtitles) {
          const similarity = this.calculateTextSimilarity(subtitle.text, other.text);
          const timeDiff = Math.abs(subtitle.start - other.start);
          
          if (similarity > 0.9 && timeDiff < 2.0) {
            isDuplicate = true;
            break;
          }
        }
      }
      
      if (!isDuplicate) {
        uniqueSubtitles.push(subtitle);
      } else {
        console.log(`Filtered duplicate: "${subtitle.text}" at ${subtitle.start}s`);
      }
    }
    
    return uniqueSubtitles;
  }

  // CONSERVATIVE: Smaller batches with better error handling for Cloudflare D1
  private async bulkInsertPhrases(DB: D1Database, videoId: number, subtitles: SubtitleEntry[]): Promise<number> {
    if (subtitles.length === 0) return 0;
    
    console.log(`Starting conservative bulk insert of ${subtitles.length} phrases`);
    
    // REDUCED batch size for D1 stability - start with 25 instead of 100
    const BATCH_SIZE = 25;
    let totalInserted = 0;
    let consecutiveErrors = 0;
    
    for (let i = 0; i < subtitles.length; i += BATCH_SIZE) {
      const batch = subtitles.slice(i, i + BATCH_SIZE);
      
      try {
        // Try bulk insert for this small batch
        const bulkResult = await this.attemptBulkInsert(DB, videoId, batch);
        
        if (bulkResult.success) {
          totalInserted += bulkResult.inserted;
          consecutiveErrors = 0; // Reset error counter on success
          console.log(`✅ Bulk inserted batch ${Math.floor(i/BATCH_SIZE) + 1}: ${bulkResult.inserted} phrases`);
        } else {
          throw new Error(bulkResult.error || 'Bulk insert failed');
        }
        
      } catch (error) {
        console.error(`❌ Bulk insert failed for batch ${Math.floor(i/BATCH_SIZE) + 1}:`, error);
        consecutiveErrors++;
        
        // If we have too many consecutive bulk failures, switch to individual mode
        if (consecutiveErrors >= 3) {
          console.log(`⚠️ Too many bulk failures, switching to individual inserts for remaining ${subtitles.length - i} phrases`);
          
          // Process remaining subtitles individually
          for (let j = i; j < subtitles.length; j++) {
            try {
              await DB.prepare(`
                INSERT INTO video_phrases (video_id, phrase_text, start_time_seconds, end_time_seconds)
                VALUES (?, ?, ?, ?)
              `).bind(videoId, subtitles[j].text, subtitles[j].start, subtitles[j].end).run();
              totalInserted++;
              
              // Log progress every 50 individual inserts
              if ((j - i) % 50 === 0) {
                console.log(`Individual insert progress: ${j - i + 1}/${subtitles.length - i}`);
              }
            } catch (individualError) {
              console.error(`Failed individual insert: "${subtitles[j].text}"`, individualError);
            }
          }
          break; // Exit the batch loop
        } else {
          // Fallback: individual inserts for this batch only
          console.log(`Fallback to individual inserts for batch ${Math.floor(i/BATCH_SIZE) + 1}`);
          for (const subtitle of batch) {
            try {
              await DB.prepare(`
                INSERT INTO video_phrases (video_id, phrase_text, start_time_seconds, end_time_seconds)
                VALUES (?, ?, ?, ?)
              `).bind(videoId, subtitle.text, subtitle.start, subtitle.end).run();
              totalInserted++;
            } catch (individualError) {
              console.error(`Failed individual insert: "${subtitle.text}"`, individualError);
            }
          }
        }
      }
    }
    
    console.log(`✅ Bulk insert completed: ${totalInserted}/${subtitles.length} phrases inserted`);
    return totalInserted;
  }

  // Helper method to attempt bulk insert with better error handling
  private async attemptBulkInsert(DB: D1Database, videoId: number, batch: SubtitleEntry[]): Promise<{success: boolean, inserted: number, error?: string}> {
    try {
      // Validate batch size
      if (batch.length === 0) {
        return { success: true, inserted: 0 };
      }
      
      if (batch.length > 50) {
        return { success: false, inserted: 0, error: `Batch size too large: ${batch.length}` };
      }
      
      // Build VALUES clause
      const placeholders = batch.map(() => '(?, ?, ?, ?)').join(', ');
      const sql = `
        INSERT INTO video_phrases (video_id, phrase_text, start_time_seconds, end_time_seconds)
        VALUES ${placeholders}
      `;
      
      // Flatten parameters
      const params: any[] = [];
      for (const subtitle of batch) {
        // Validate subtitle data
        if (!subtitle.text || typeof subtitle.start !== 'number' || typeof subtitle.end !== 'number') {
          return { success: false, inserted: 0, error: 'Invalid subtitle data' };
        }
        params.push(videoId, subtitle.text, subtitle.start, subtitle.end);
      }
      
      // Check parameter count (D1 limit is ~32766 parameters)
      if (params.length > 1000) {
        return { success: false, inserted: 0, error: `Too many parameters: ${params.length}` };
      }
      
      const result = await DB.prepare(sql).bind(...params).run();
      return { success: true, inserted: batch.length };
      
    } catch (error) {
      return { 
        success: false, 
        inserted: 0, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Helper method for text normalization (used in bulk filtering)
  private normalizeForComparison(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')    // Normalize spaces
      .trim();
  }

  // NEW: Calculate text similarity for duplicate detection
  private calculateTextSimilarity(text1: string, text2: string): number {
    const normalize = (text: string) => text.toLowerCase().replace(/[^\w\s]/g, '').trim();
    const norm1 = normalize(text1);
    const norm2 = normalize(text2);
    
    if (norm1 === norm2) return 1.0; // 100% identical
    
    // Check substring containment (progressive reveals)
    if (norm1.includes(norm2) || norm2.includes(norm1)) {
      return 0.9; // 90% similar for containment
    }
    
    // Word-based similarity
    const words1 = norm1.split(/\s+/);
    const words2 = norm2.split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word));
    const maxLength = Math.max(words1.length, words2.length);
    
    return maxLength > 0 ? commonWords.length / maxLength : 0;
  }
}
