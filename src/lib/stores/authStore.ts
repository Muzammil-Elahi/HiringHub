import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { supabase } from '$lib/supabaseClient';
import type { Session } from '@supabase/supabase-js';

// Create store with initial state
const createAuthStore = () => {
  const { subscribe, set, update } = writable({
    session: null as Session | null,
    loading: false,
    error: null as Error | null
  });

  return {
    subscribe,
    setSession: (session: Session | null) => {
      update(state => ({ ...state, session }));
    },
    setLoading: (loading: boolean) => {
      update(state => ({ ...state, loading }));
    },
    setError: (error: Error | null) => {
      update(state => ({ ...state, error }));
    },
    // Check if user is authenticated
    checkAuth: async () => {
      if (!browser) return;
      
      update(state => ({ ...state, loading: true, error: null }));
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        update(state => ({ ...state, session: data.session }));
      } catch (error) {
        console.error('Error checking auth:', error);
        update(state => ({ ...state, error: error as Error, loading: false }));
      } finally {
        // Only set loading to false if there's a session
        // This ensures we don't show loading screen longer than needed
        update(state => {
          if (state.error || !state.session) {
            return { ...state, loading: false };
          }
          return state;
        });
      }
    },
    // Sign in with email/password
    login: async (email: string, password: string) => {
      update(state => ({ ...state, loading: true, error: null }));
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        
        if (error) {
          // Immediately turn off loading if there's an error
          update(state => ({ ...state, error: error as Error, loading: false }));
          return { success: false, error };
        }
        
        update(state => ({ ...state, session: data.session }));
        return { success: true, data };
      } catch (error) {
        console.error('Login error:', error);
        // Ensure loading is turned off on error
        update(state => ({ ...state, error: error as Error, loading: false }));
        return { success: false, error };
      }
      // Don't set loading to false on success - the layout component handles this
      // after profile fetch and redirect
    },
    // Sign up with email/password
    register: async (email: string, password: string) => {
      update(state => ({ ...state, loading: true, error: null }));
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password
        });
        
        if (error) {
          // Immediately turn off loading if there's an error
          update(state => ({ ...state, error: error as Error, loading: false }));
          return { success: false, error };
        }
        
        update(state => ({ ...state, session: data.session }));
        return { success: true, data };
      } catch (error) {
        console.error('Registration error:', error);
        // Ensure loading is turned off on error
        update(state => ({ ...state, error: error as Error, loading: false }));
        return { success: false, error };
      }
      // Don't set loading to false on success - handled elsewhere
    },
    // Request password reset email
    resetPassword: async (email: string) => {
      update(state => ({ ...state, loading: true, error: null }));
      try {
        // The redirectTo option can be set to specify where to redirect after password reset
        // By default, Supabase redirects to the site URL if not specified
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: browser ? `${window.location.origin}/reset-password/confirm` : undefined
        });
        
        if (error) {
          update(state => ({ ...state, error: error as Error, loading: false }));
          return { success: false, error };
        }
        
        return { success: true };
      } catch (error) {
        console.error('Password reset error:', error);
        update(state => ({ ...state, error: error as Error, loading: false }));
        return { success: false, error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },
    // Update password after reset
    updatePassword: async (newPassword: string) => {
      update(state => ({ ...state, loading: true, error: null }));
      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword
        });
        
        if (error) {
          update(state => ({ ...state, error: error as Error, loading: false }));
          return { success: false, error };
        }
        
        return { success: true };
      } catch (error) {
        console.error('Password update error:', error);
        update(state => ({ ...state, error: error as Error, loading: false }));
        return { success: false, error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },
    // Sign out
    logout: async () => {
      update(state => ({ ...state, loading: true, error: null }));
      try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        update(state => ({ ...state, session: null }));
        return { success: true };
      } catch (error) {
        console.error('Logout error:', error);
        update(state => ({ ...state, error: error as Error, loading: false }));
        return { success: false, error };
      } finally {
        update(state => ({ ...state, loading: false }));
      }
    },
    reset: () => {
      set({
        session: null,
        loading: false,
        error: null
      });
    }
  };
};

const authStore = createAuthStore();
export default authStore; 