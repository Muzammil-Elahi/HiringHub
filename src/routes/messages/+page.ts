import { redirect } from '@sveltejs/kit';
import type { PageLoad } from './$types';

export const load: PageLoad = async ({ parent, url }) => {
  // Get parent data which includes session info
  const { session, profile } = await parent();
  
  // Redirect if not logged in
  if (!session) {
    throw redirect(303, '/login');
  }
  
  // Make sure the user has a profile
  if (!profile) {
    throw redirect(303, '/profile');
  }
  
  // Check if there's a chat id parameter
  const chatId = url.searchParams.get('id');
  
  return {
    session,
    profile,
    chatId
  };
}; 