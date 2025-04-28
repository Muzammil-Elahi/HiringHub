import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import authStore from '$lib/stores/authStore';
import { get } from 'svelte/store';

/**
 * Checks if the user is authenticated and redirects to login if not
 * @param redirectPath Optional path to redirect to if auth fails. Defaults to '/login'
 * @returns True if authenticated, false if not (and triggers redirect)
 */
export function requireAuth(redirectPath: string = '/login'): boolean {
  if (!browser) return false;
  
  const auth = get(authStore);
  
  if (!auth.isAuthenticated) {
    goto(redirectPath, { replaceState: true });
    return false;
  }
  
  return true;
}

/**
 * Gets the current access token for API requests
 * @returns The current access token or null
 */
export function getAccessToken(): string | null {
  if (!browser) return null;
  return get(authStore).accessToken;
}

/**
 * Adds authorization header to fetch options
 * @param options Existing fetch options or empty object
 * @returns Updated fetch options with Authorization header
 */
export function withAuth(options: RequestInit = {}): RequestInit {
  const token = getAccessToken();
  
  if (!token) return options;
  
  return {
    ...options,
    headers: {
      ...(options.headers || {}),
      'Authorization': `Bearer ${token}`
    }
  };
} 