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
      
      update(state => ({ ...state, loading: true }));
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        update(state => ({ ...state, session: data.session }));
      } catch (error) {
        console.error('Error checking auth:', error);
        update(state => ({ ...state, error: error as Error }));
      } finally {
        update(state => ({ ...state, loading: false }));
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
        
        if (error) throw error;
        
        update(state => ({ ...state, session: data.session }));
        return { success: true, data };
      } catch (error) {
        console.error('Login error:', error);
        update(state => ({ ...state, error: error as Error }));
        return { success: false, error };
      } finally {
        // Don't turn off loading here - let the layout component handle this
        // after redirection has been handled
        // The layout will set loading to false after profile fetch and redirect
      }
    },
    // Sign up with email/password
    register: async (email: string, password: string) => {
      update(state => ({ ...state, loading: true, error: null }));
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password
        });
        
        if (error) throw error;
        
        update(state => ({ ...state, session: data.session }));
        return { success: true, data };
      } catch (error) {
        console.error('Registration error:', error);
        update(state => ({ ...state, error: error as Error }));
        return { success: false, error };
      } finally {
        setTimeout(() => {
          update(state => ({ ...state, loading: false }));
        }, 1000); // Small delay to ensure redirect happens
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
        update(state => ({ ...state, error: error as Error }));
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