import { supabase } from '$lib/supabaseClient';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  // Get parent data which includes session info
  const { session } = await parent();
  
  // Allow access to this page even for non-logged-in users (they just can't apply)
  
  try {
    // Fetch active jobs with their skills
    const { data: jobs, error } = await supabase
      .from('jobs')
      .select(`
        *,
        job_skills (
          skill_id,
          skill_name,
          is_required
        )
      `)
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    return {
      jobs: jobs || [],
      session: session
    };
  } catch (err) {
    console.error('Error loading jobs:', err);
    return {
      jobs: [],
      session: session
    };
  }
}; 