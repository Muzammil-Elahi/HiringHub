import { redirect, type Handle } from '@sveltejs/kit';
import { supabase } from '$lib/supabaseClient';

export const handle: Handle = async ({ event, resolve }) => {
  // Get auth state in each request
  event.locals.supabase = supabase;
  
  // Refresh session if available
  const {
    data: { session }
  } = await supabase.auth.getSession();
  
  // Make session available in events
  event.locals.session = session;
  
  // Get user profile if session exists
  if (session) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();
      
    event.locals.profile = profile;
  }
  
  // Protect routes that require authentication
  const protectedRoutes = ['/jobs/post', '/profile/hiring-manager'];
  const isProtectedRoute = protectedRoutes.some(route => 
    event.url.pathname.startsWith(route)
  );
  
  if (isProtectedRoute && !session) {
    throw redirect(303, '/login');
  }
  
  // Continue with the response
  return resolve(event);
}; 