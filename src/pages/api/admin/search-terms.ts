import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ locals }) => {
  try {
    const { DB } = locals.runtime.env;
    
    // Get search terms with video counts
    const query = `
      SELECT 
        st.*,
        COUNT(DISTINCT v.id) as video_count,
        COUNT(DISTINCT CASE WHEN v.processing_status = 'Subtitles Processed' THEN v.id END) as processed_count
      FROM search_terms st
      LEFT JOIN videos v ON v.search_term_id = st.id
      GROUP BY st.id, st.term_text, st.status, st.admin_id, st.last_discovery_run_at, st.created_at, st.updated_at, st.error_message
      ORDER BY st.created_at DESC
    `;

    const results = await DB.prepare(query).all();

    return new Response(JSON.stringify({ 
      searchTerms: results.results || [] 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fetching search terms:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to fetch search terms',
      searchTerms: [] 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { DB } = locals.runtime.env;
    const { term } = await request.json();
    
    if (!term || typeof term !== 'string' || term.trim().length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Term is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Use admin ID 1 for now (you might want to implement proper auth)
    const insertQuery = `
      INSERT INTO search_terms (term_text, admin_id, status)
      VALUES (?, 1, 'Pending Discovery')
      RETURNING *
    `;

    const result = await DB.prepare(insertQuery)
      .bind(term.trim())
      .first();

    return new Response(JSON.stringify({ 
      success: true,
      searchTerm: result 
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error adding search term:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to add search term' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
export const DELETE: APIRoute = async ({ request, locals }) => {
  try {
    const { DB } = locals.runtime.env;
    const { id } = await request.json();
    
    if (!id || typeof id !== 'number') {
      return new Response(JSON.stringify({ 
        error: 'Valid ID is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const deleteQuery = `DELETE FROM search_terms WHERE id = ?`;
    
    await DB.prepare(deleteQuery).bind(id).run();

    return new Response(JSON.stringify({ 
      success: true 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error deleting search term:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to delete search term' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};