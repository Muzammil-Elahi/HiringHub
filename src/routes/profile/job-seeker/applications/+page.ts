import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';
import { supabase } from '$lib/supabaseClient';

export const load: PageLoad = async ({ parent }) => {
  // Get parent data which includes session info
  const { session, profile } = await parent();
  
  // Redirect if not logged in
  if (!session) {
    throw redirect(303, '/login');
  }
  
  // Ensure only job seekers can access this page
  if (!profile || profile.account_type !== 'job_seeker') {
    throw redirect(303, '/profile');
  }
  
  try {
    // Fetch the job seeker's applications with job details
    const { data: applications, error: applicationsError } = await supabase
      .from('applications')
      .select(`
        *,
        jobs:job_id (
          id,
          title,
          company_name,
          location,
          job_type,
          salary_min,
          salary_max,
          salary_currency,
          hiring_manager_id
        )
      `)
      .eq('job_seeker_id', session.user.id)
      .order('application_date', { ascending: false });
      
    if (applicationsError) {
      console.error('Error fetching applications:', applicationsError);
      return {
        applications: [],
        error: applicationsError.message
      };
    }
    
    return {
      applications: applications || [],
      error: null
    };
  } catch (err: any) {
    console.error('Error in applications page loader:', err);
    return {
      applications: [],
      error: err.message || 'Failed to load applications'
    };
  }
}; 