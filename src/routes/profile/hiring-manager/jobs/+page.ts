import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  // Get parent data which includes session info
  const { session, profile } = await parent();
  
  // Redirect if not logged in or not a hiring manager
  if (!session) {
    throw redirect(302, '/login');
  }
  
  if (profile?.account_type !== 'hiring_manager') {
    throw redirect(302, '/profile/job-seeker');
  }
  
  return {};
}; 