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
    });  // OPTIMIZED: Bulk filter duplicates in memory instead of individual database calls
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

  // OPTIMIZED: Bulk insert using single SQL statement with multiple VALUES
  private async bulkInsertPhrases(DB: D1Database, videoId: number, subtitles: SubtitleEntry[]): Promise<number> {
    if (subtitles.length === 0) return 0;
    
    // SQLite/D1 has a limit on the number of parameters, so batch in chunks of 100
    const BATCH_SIZE = 100;
    let totalInserted = 0;
    
    for (let i = 0; i < subtitles.length; i += BATCH_SIZE) {
      const batch = subtitles.slice(i, i + BATCH_SIZE);
      
      // Build VALUES clause for bulk insert
      const placeholders = batch.map(() => '(?, ?, ?, ?)').join(', ');
      const sql = `
        INSERT INTO video_phrases (video_id, phrase_text, start_time_seconds, end_time_seconds)
        VALUES ${placeholders}
      `;
      
      // Flatten parameters: [videoId, text, start, end, videoId, text, start, end, ...]
      const params: any[] = [];
      for (const subtitle of batch) {
        params.push(videoId, subtitle.text, subtitle.start, subtitle.end);
      }
      
      try {
        const result = await DB.prepare(sql).bind(...params).run();
        totalInserted += batch.length;
        console.log(`Bulk inserted batch of ${batch.length} phrases (total: ${totalInserted})`);
      } catch (error) {
        console.error(`Error in bulk insert batch ${i}-${i + batch.length}:`, error);
        
        // Fallback: individual inserts for this batch if bulk fails
        for (const subtitle of batch) {
          try {
            await DB.prepare(`
              INSERT INTO video_phrases (video_id, phrase_text, start_time_seconds, end_time_seconds)
              VALUES (?, ?, ?, ?)
            `).bind(videoId, subtitle.text, subtitle.start, subtitle.end).run();
            totalInserted++;
          } catch (individualError) {
            console.error(`Failed to insert individual phrase: "${subtitle.text}"`, individualError);
          }
        }
      }
    }
    
    return totalInserted;
  }

  // Helper method for text normalization (used in bulk filtering)
  private normalizeForComparison(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove punctuation
      .replace(/\s+/g, ' ')    // Normalize spaces
      .trim();
  }