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
    
    // Initialize auth state from stored tokens or session
    initialize: async () => {
      update(state => ({ ...state, loading: true }));
      
      // Try to get session from Supabase
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // We have a valid session
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
        // Check if we have tokens in localStorage
        const accessToken = browser ? localStorage.getItem('accessToken') : null;
        const refreshToken = browser ? localStorage.getItem('refreshToken') : null;
        
        if (accessToken && refreshToken) {
          // Try to refresh the session
          try {
            const { data, error } = await supabase.auth.refreshSession({
              refresh_token: refreshToken,
            });
            
            if (error) throw error;
            
            set({
              isAuthenticated: true,
              session: data.session,
              accessToken: data.session?.access_token || null,
              refreshToken: data.session?.refresh_token || null,
              userId: data.session?.user?.id || null,
              authEmail: data.session?.user?.email || null,
              loading: false
            });
            
            // Update localStorage with new tokens
            if (browser && data.session) {
              localStorage.setItem('accessToken', data.session.access_token);
              localStorage.setItem('refreshToken', data.session.refresh_token);
            }
          } catch (error) {
            console.error('Failed to refresh session:', error);
            // Clear invalid tokens
            if (browser) {
              localStorage.removeItem('accessToken');
              localStorage.removeItem('refreshToken');
            }
            set({
              ...initialState,
              loading: false
            });
          }
        } else {
          // No tokens, not authenticated
          set({
            ...initialState,
            loading: false
          });
        }
      }
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