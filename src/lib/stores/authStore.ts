import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { supabase } from '$lib/supabaseClient';
import type { AuthSession } from '@supabase/supabase-js';

export interface AuthState {
  isAuthenticated: boolean;
  session: AuthSession | null;
  accessToken: string | null;
  refreshToken: string | null;
  userId: string | null;
  authEmail: string | null;
  loading: boolean;
}

// Initial state
const initialState: AuthState = {
  isAuthenticated: false,
  session: null,
  accessToken: browser ? localStorage.getItem('accessToken') : null,
  refreshToken: browser ? localStorage.getItem('refreshToken') : null,
  userId: null,
  authEmail: null,
  loading: true
};

function createAuthStore() {
  const { subscribe, set, update } = writable<AuthState>(initialState);

  return {
    subscribe,
    
    // Quick auth check using stored token
    checkAuth: async () => {
      console.log('Checking auth method 1');
      const accessToken = browser ? localStorage.getItem('accessToken') : null;
      if (!accessToken) {
        set({ ...initialState, loading: false });
        return false;
      }

      try {
        const { data: { user }, error: userError } = await supabase.auth.getUser(accessToken);
        
        if (user && !userError) {
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            set({
              isAuthenticated: true,
              session,
              accessToken: session.access_token,
              refreshToken: session.refresh_token,
              userId: session.user?.id || null,
              authEmail: session.user?.email || null,
              loading: false
            });
            return true;
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
      }

      set({ ...initialState, loading: false });
      return false;
    },
    
    // Set auth state from login/session
    setSession: (session: AuthSession | null) => {
      if (session) {
        set({
          isAuthenticated: true,
          session,
          accessToken: session.access_token,
          refreshToken: session.refresh_token,
          userId: session.user?.id || null,
          authEmail: session.user?.email || null,
          loading: false
        });
        
        // Update localStorage
        if (browser) {
          localStorage.setItem('accessToken', session.access_token);
          localStorage.setItem('refreshToken', session.refresh_token);
        }
      } else {
        // Clear session (logout)
        set({
          ...initialState,
          loading: false
        });
        
        // Remove from localStorage
        if (browser) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
        }
      }
    },
    
    // Logout user
    logout: async () => {
      const { error } = await supabase.auth.signOut();
      
      if (error) {
        console.error('Error during logout:', error);
      }
      
      // Clear state and localStorage regardless of error
      set({
        ...initialState,
        loading: false
      });
      
      if (browser) {
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
      }
    },
    
    // Get current access token
    getAccessToken: () => {
      return browser ? localStorage.getItem('accessToken') : null;
    }
  };
}

const authStore = createAuthStore();

export default authStore; 