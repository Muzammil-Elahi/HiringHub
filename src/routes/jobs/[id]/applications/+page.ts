import { error, redirect } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ params, parent }) => {
  // Get data from parent layout
  const parentData = await parent();
  const { session, profile } = parentData;

  // Check authentication
  if (!session) {
    throw redirect(302, '/login');
  }

  // Ensure the user is a hiring manager
  if (profile?.account_type !== 'hiring_manager') {
    throw error(403, 'Only hiring managers can view applications');
  }

  const { id } = params;

  if (!id) {
    throw error(404, 'Job not found - missing ID');
  }

  // Fetch job details
  const { data: job, error: jobError } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', id)
    .single();

  if (jobError) {
    throw error(404, jobError.message);
  }

  if (!job) {
    throw error(404, 'Job not found');
  }

  // Ensure the hiring manager owns this job
  if (job.hiring_manager_id !== session.user.id) {
    throw error(403, 'You do not have permission to view applications for this job');
  }

  return {
    job
  };
}; 