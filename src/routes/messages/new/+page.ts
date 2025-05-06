import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent }) => {
  // Get parent data which includes session info
  const { session, profile } = await parent();
  
  // Redirect if not logged in
  if (!session) {
    throw redirect(303, '/login');
  }
  
  // Make sure only hiring managers can access this page
  if (!profile || profile.account_type !== 'hiring_manager') {
    throw redirect(303, '/messages');
  }
  
  return {
    session,
    profile
  };
}; 