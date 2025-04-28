import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  // Get parent data which includes session info
  const { session, profile } = await parent();
  
  // Redirect if not logged in
  if (!session) {
    throw redirect(303, '/login');
  }
  
  // Redirect if not a hiring manager
  if (profile?.account_type !== 'hiring_manager') {
    throw redirect(303, '/profile/job-seeker');
  }
  
  return {
    session,
    profile
  };
}; 