import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  // Get parent data which includes session info
  const { session, profile } = await parent();
  
  // Redirect if not logged in
  if (!session) {
    throw redirect(303, '/login');
  }
  
  // Make sure only job seekers or users without profile type can access this page
  if (profile?.account_type && profile.account_type !== 'job_seeker') {
    throw redirect(303, '/profile/hiring-manager');
  }
  
  return {
    session,
    profile
  };
}; 