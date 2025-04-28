import { error } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
  // Use browser console logging for debugging
  try {
    const parentData = await parent();
    if (typeof window !== 'undefined') {
      console.log('parentData:', parentData);
    }
    const { session, profile } = parentData;
    const { id } = params;

    if (!id) {
      if (typeof window !== 'undefined') {
        console.error('Job not found - missing ID');
      }
      throw error(404, 'Job not found - missing ID');
    }

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

    if (jobError) {
      if (typeof window !== 'undefined') {
        console.error('Supabase jobError:', jobError);
      }
      throw error(404, jobError.message);
    }
    if (!job) {
      if (typeof window !== 'undefined') {
        console.error('Job not found');
      }
      throw error(404, 'Job not found');
    }

    if (!session || session.user.id !== job.hiring_manager_id) {
      if (typeof window !== 'undefined') {
        console.error('You are not authorized to edit this job');
      }
      throw error(403, 'You are not authorized to edit this job');
    }

    if (typeof window !== 'undefined') {
      console.log('Loaded job for editing:', job);
    }
    return { job, session, profile };
  } catch (err) {
    if (typeof window !== 'undefined') {
      console.error('Edit job loader error:', err);
    }
    throw error(500, 'Internal Server Error');
  }
}; 