import { writable } from 'svelte/store';

export type AccountType = 'job_seeker' | 'hiring_manager' | null;

// Store to hold the currently selected account type during registration
export const selectedAccountType = writable<AccountType>(null); 