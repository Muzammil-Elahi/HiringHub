import { supabase } from '$lib/supabaseClient';
import type { LayoutLoad } from './$types';

export const prerender = false;

export const load: LayoutLoad = async ({ fetch, depends }) => {
  // Trigger dependency invalidation on auth state change
  depends('app:auth');
  
  // Get session from Supabase on the server side
  const { data: { session } } = await supabase.auth.getSession();
  
  // If there's a session, try to get the profile
  let profile = null;
  if (session?.user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', session.user.id)
      .maybeSingle();
    
    profile = data;
  }
  
  return {
    session,
    profile
  };
}; 