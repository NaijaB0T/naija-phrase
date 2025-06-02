import type { APIRoute } from 'astro';

export const POST: APIRoute = async ({ request, locals }) => {
  try {
    const { DB, VIDEO_DISCOVERY_WORKFLOW } = locals.runtime.env;
    const { searchTermId } = await request.json();
    
    if (!searchTermId || typeof searchTermId !== 'number') {
      return new Response(JSON.stringify({ 
        error: 'Valid search term ID is required' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Get the search term
    const searchTerm = await DB.prepare(`
      SELECT * FROM search_terms WHERE id = ?
    `).bind(searchTermId).first();

    if (!searchTerm) {
      return new Response(JSON.stringify({ 
        error: 'Search term not found' 
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Trigger the video discovery workflow
    try {
      const workflowId = `video-discovery-${searchTermId}-${Date.now()}`;
      const instance = await VIDEO_DISCOVERY_WORKFLOW.create({
        id: workflowId,
        params: {
          searchTermId: searchTermId,
          searchTerm: searchTerm.term_text
        }
      });

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Video discovery workflow started',
        workflowId: workflowId,
        instanceId: instance.id
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (workflowError) {
      console.error('Workflow creation error:', workflowError);
      
      // Fallback: Just update the status manually
      await DB.prepare(`
        UPDATE search_terms 
        SET status = 'Pending Discovery', 
            last_discovery_run_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).bind(searchTermId).run();

      return new Response(JSON.stringify({ 
        success: true,
        message: 'Discovery queued (workflow unavailable)',
        fallback: true
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('Error triggering discovery:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to trigger discovery' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};