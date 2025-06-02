import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const { DB } = locals.runtime.env;
    
    // Get recent error logs and details
    const errorSearchTerms = await DB.prepare(`
      SELECT id, term_text, status, last_discovery_run_at, updated_at
      FROM search_terms 
      WHERE status = 'Error'
      ORDER BY updated_at DESC
      LIMIT 10
    `).all();

    // Get videos with processing errors
    const errorVideos = await DB.prepare(`
      SELECT v.*, st.term_text
      FROM videos v
      LEFT JOIN search_terms st ON st.id = v.search_term_id
      WHERE v.processing_status LIKE 'Error%'
      ORDER BY v.updated_at DESC
      LIMIT 10
    `).all();

    return new Response(JSON.stringify({ 
      errorSearchTerms: errorSearchTerms.results || [],
      errorVideos: errorVideos.results || []
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching error logs:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch error logs',
      errorSearchTerms: [],
      errorVideos: []
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};