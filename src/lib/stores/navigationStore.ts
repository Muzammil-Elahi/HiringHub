import { writable } from 'svelte/store';

// Add the new view names to the type definition
export type View = 'home' | 'login' | 'register' | 'profile' | 'post_job' | 'job_board';

// Store to hold the currently active view/page
export const currentView = writable<View>('home');

// Helper function to change the view
export function navigateTo(view: View) {
  currentView.set(view);
} 