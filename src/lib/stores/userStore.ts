import { writable } from 'svelte/store';
import type { AuthSession, User } from '@supabase/supabase-js';

// Define a type for our profile data (adjust based on your actual profiles table columns)
export interface Profile {
  user_id: string;
  account_type: 'job_seeker' | 'hiring_manager';
  full_name: string | null;
  avatar_url: string | null;
  company_name: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  linkedin_url: string | null;
  resume_url: string | null;
  resume_filename: string | null;
  company_website: string | null;
  created_at: string | null;
  updated_at: string | null;
  // Add other profile fields as needed
  [key: string]: any; // Allow other properties if necessary
}

// Define the shape of our user store state
interface UserStoreState {
  loggedIn: boolean;
  session: AuthSession | null;
  user: User | null;
  profile: Profile | null;
}

// Initial state
const initialState: UserStoreState = {
  loggedIn: false,
  session: null,
  user: null,
  profile: null,
};

// Create the writable store
const userStore = writable<UserStoreState>(initialState);

export default {
  subscribe: userStore.subscribe,
  set: userStore.set, // Expose set for direct manipulation if needed (e.g., on logout)
  update: userStore.update, // Expose update for more complex state changes

  // Helper function to reset the store on logout
  reset: () => {
    userStore.set(initialState);
  },

  // Helper function to update profile (example)
  updateProfile: (profileData: Partial<Profile>) => {
    userStore.update(state => {
      if (state.profile) {
        return { ...state, profile: { ...state.profile, ...profileData } };
      }
      return state;
    });
  }
}; 