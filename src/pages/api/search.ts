import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request, locals }) => {
  try {
    const { DB } = locals.runtime.env;
    const url = new URL(request.url);
    const query = url.searchParams.get('q');
    const limitParam = url.searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam), 1000) : 20; // Default 20, max 1000
    
    if (!query || query.trim().length === 0) {
      return new Response(JSON.stringify({ results: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const trimmedQuery = query.trim();
    let results = [];

    try {
      // Enhanced search with letter-by-letter matching and performance limits
      const likeQuery = `%${trimmedQuery.toLowerCase()}%`;
      const searchQuery = `
        SELECT 
          vp.id,
          vp.video_id,
          vp.phrase_text,
          vp.start_time_seconds,
          vp.end_time_seconds,
          v.youtube_video_id,
          v.title as video_title,
          v.thumbnail_url as video_thumbnail,
          v.channel_title,
          v.published_at,
          -- Calculate relevance score for better ordering
          CASE 
            WHEN LOWER(vp.phrase_text) = LOWER(?) THEN 100  -- Exact match
            WHEN LOWER(vp.phrase_text) LIKE LOWER(?) THEN 90  -- Starts with query
            WHEN LOWER(vp.phrase_text) LIKE ? THEN 80  -- Contains query
            ELSE 70  -- Partial match
          END as relevance_score,
          -- Calculate match position for ordering
          INSTR(LOWER(vp.phrase_text), LOWER(?)) as match_position
        FROM video_phrases vp
        JOIN videos v ON v.id = vp.video_id
        WHERE LOWER(vp.phrase_text) LIKE ?
        ORDER BY 
          relevance_score DESC,
          match_position ASC,
          LENGTH(vp.phrase_text) ASC,
          vp.start_time_seconds ASC
        LIMIT ?  -- Performance limit as requested
      `;

      const exactMatch = trimmedQuery.toLowerCase();
      const startsWithMatch = `${trimmedQuery.toLowerCase()}%`;
      
      const searchResults = await DB.prepare(searchQuery)
        .bind(exactMatch, startsWithMatch, likeQuery, trimmedQuery, likeQuery, limit)
        .all();
      
      results = searchResults.results || [];

      // If we have no results with LIKE, try FTS5 as fallback
      if (results.length === 0) {
        try {
          const ftsQuery = prepareFTSQuery(trimmedQuery);
          const ftsSearchQuery = `
            SELECT 
              vp.id,
              vp.video_id,
              vp.phrase_text,
              vp.start_time_seconds,
              vp.end_time_seconds,
              v.youtube_video_id,
              v.title as video_title,
              v.thumbnail_url as video_thumbnail,
              v.channel_title,
              v.published_at,
              95 as relevance_score,
              1 as match_position
            FROM video_phrases_fts vp_fts
            JOIN video_phrases vp ON vp.id = vp_fts.rowid
            JOIN videos v ON v.id = vp.video_id
            WHERE video_phrases_fts MATCH ?
            ORDER BY rank
            LIMIT ?
          `;

          const ftsResults = await DB.prepare(ftsSearchQuery).bind(ftsQuery, limit).all();
          results = ftsResults.results || [];
        } catch (ftsError) {
          console.log('FTS5 fallback also failed:', ftsError.message);
        }
      }

    } catch (searchError) {
      console.error('Search query failed:', searchError);
      results = [];
    }

    return new Response(JSON.stringify({ 
      results: results,
      query: trimmedQuery,
      count: results.length,
      limited: results.length === 1000
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Search API error:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Search temporarily unavailable',
      results: [],
      query: '',
      count: 0
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

// Helper function to prepare FTS5 query
function prepareFTSQuery(query: string): string {
  let ftsQuery = query
    .replace(/['"]/g, '') // Remove quotes
    .replace(/[()]/g, '') // Remove parentheses
    .replace(/[+\-*]/g, '') // Remove FTS operators
    .replace(/:/g, '') // Remove colons
    .trim();
  
  if (ftsQuery.length === 0) {
    return query.replace(/[^a-zA-Z0-9\s]/g, '');
  }
  
  if (ftsQuery.length >= 2) {
    ftsQuery = `"${ftsQuery}"*`;
  }
  
  return ftsQuery;
}