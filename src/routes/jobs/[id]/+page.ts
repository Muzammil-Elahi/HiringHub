import { error } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
  // Get parent data which includes session info
  const { session } = await parent();
  
  const { id } = params;
  
  if (!id) {
    throw error(404, 'Job not found - missing ID');
  }
  
  try {
    // Fetch job with related skills (now using skill_name directly)
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .select(`
        *,
        job_skills (
          skill_id,
          skill_name,
          is_required
        )
      `)
      .eq('id', id)
      .single();
    
    if (jobError) throw jobError;
    
    if (!job) {
      throw error(404, 'Job not found');
    }
    
    // Don't show inactive jobs to non-owners
    if (!job.is_active && (!session || session.user.id !== job.hiring_manager_id)) {
      throw error(404, 'Job listing is not active');
    }
    
    return {
      job,
      session
    };
  } catch (err) {
    console.error('Error loading job:', err);
    throw error(404, 'Could not load job details');
  }
}; 