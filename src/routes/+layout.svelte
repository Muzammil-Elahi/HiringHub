<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';

	// Import global styles
	import "../app.css"; // Use relative path from routes directory

	// Stores (adjust path if necessary)
	import userStore, { type Profile } from '$lib/stores/userStore'; // Import the user store
	import authStore from '$lib/stores/authStore'; // Import the new auth store

	// State for profile fetching indicator (could be useful)
	let profileLoading = false;

	onMount(() => {
		// Auth handling only runs in the browser
		if (!browser) return;

		// Initialize auth store (this will handle token validation)
		authStore.initialize();

		// Get initial session state
		supabase.auth.getSession().then(({ data: { session } }) => {
			if (session) {
				console.log("Initial session found", session);
				_handleAuthChange('INITIAL_SESSION', session);
			} else {
				console.log("No initial session");
                userStore.reset(); // Ensure logged out state if no initial session
            }
		});

		// Listen for auth changes
		const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
			console.log("Auth change event:", event);
			// Update auth store first
			authStore.setSession(session);
			// Then handle user profile
			_handleAuthChange(event, session);
		});

		// Cleanup listener on component destroy
		return () => {
			authListener?.subscription.unsubscribe();
		};
	});

	// Helper function to handle auth state changes and fetch profile
	async function _handleAuthChange(event: AuthChangeEvent, session: Session | null) {
		console.log('Handling Auth event:', event, session);
		if (session && session.user) {
			// User is logged in, fetch profile if not already loaded
			if (!$userStore.profile || $userStore.profile.user_id !== session.user.id) {
				profileLoading = true;
				try {
					const { data: profileData, error: profileError, status } = await supabase
						.from('profiles')
						.select('*')
						.eq('user_id', session.user.id)
						.maybeSingle();

					if (profileError && status !== 406) {
						console.error('Error fetching profile:', profileError);
						userStore.set({
							loggedIn: true,
							session: session,
							user: session.user,
							profile: null
						});
					} else {
						console.log('Profile fetched:', profileData);
						userStore.set({
							loggedIn: true,
							session: session,
							user: session.user,
							profile: profileData as Profile
						});

						// Only navigate on SIGNED_IN event, not on INITIAL_SESSION
						if (event === 'SIGNED_IN') {
							if (profileData?.account_type === 'job_seeker') {
								await goto('/profile/job-seeker', { replaceState: true });
							} else if (profileData?.account_type === 'hiring_manager') {
								await goto('/profile/hiring-manager', { replaceState: true });
							} else {
								// Default case - don't navigate anywhere if profile type is unknown
								console.log('Unknown account type, staying on current page');
							}
						}
					}
				} catch (e) {
					console.error('Exception fetching profile:', e);
					userStore.set({
						loggedIn: true,
						session: session,
						user: session.user,
						profile: null
					});
				} finally {
					profileLoading = false;
				}
			} else {
				// Profile already loaded, just update session/user info if needed
				console.log("Profile already in store, updating session info");
				userStore.update(current => ({
					...current,
					loggedIn: true,
					session: session,
					user: session.user
				}));
			}
		} else {
			// User is logged out
			console.log("User logged out");
			userStore.reset();
			// Only redirect to login if on a protected route
			const protectedRoutes = ['/jobs/post', '/profile/hiring-manager', '/profile/job-seeker'];
			const isProtectedRoute = protectedRoutes.some(route => 
				window.location.pathname.startsWith(route)
			);
			if (isProtectedRoute) {
				await goto('/login', { replaceState: true });
			}
		}
	}

	// Logout function
	async function handleLogout() {
		try {
			console.log("Logging out user...");
			// Use the auth store's logout function
			await authStore.logout();
			
			// Explicitly reset user store
			userStore.reset();
			
			// Navigate to home after logout
			console.log("Redirecting to home page");
			await goto('/', { replaceState: true });
		} catch (error) {
			console.error("Error during logout:", error);
		}
	}

	// Determine profile link based on account type
	$: profileLink = $userStore.profile?.account_type === 'job_seeker'
		? '/profile/job-seeker'
		: $userStore.profile?.account_type === 'hiring_manager'
			? '/profile/hiring-manager' 
			: $userStore.loggedIn 
				? '/profile' // Changed: Don't default to any specific profile type
				: '/login'; // Only go to login if not logged in

	// ---> DEBUGGING START
	$: console.log('User store for nav link:', $userStore);
	$: console.log('Auth store state:', $authStore);
	$: console.log('Calculated profileLink:', profileLink);
	// ---> DEBUGGING END

	$: jobBoardLink = '/jobs/board'; // Updated to a more consistent route pattern
	$: postJobLink = '/jobs/post'; // Updated path to match our new route

</script>

<nav>
	{#if $userStore.loggedIn}
		<!-- Logged-in user links -->
		<a href="/">Home</a>
		<a href={profileLink}>Profile</a>
		<!-- Add links based on account type -->
		{#if $userStore.profile?.account_type === 'hiring_manager'}
			 <a href={postJobLink}>Post Job</a>
		{:else if $userStore.profile?.account_type === 'job_seeker'}
			 <a href={jobBoardLink}>Job Board</a>
		{/if}
		<!-- Use a button for actions like logout -->
		<button type="button" class="logout-link" on:click={() => {
			authStore.logout().then(() => {
				userStore.reset();
				goto('/');
			}).catch(err => console.error('Logout error:', err));
		}}>Logout</button>
	{:else}
		<!-- Logged-out user links -->
		<a href="/">Home</a>
		<a href="/login">Login</a>
		<a href="/register">Register</a>
	{/if}
</nav>

<main>
	{#if profileLoading && $userStore.loggedIn}
		<p>Loading user profile...</p> <!-- Show profile loading indicator -->
	{:else}
		<slot /> <!-- Page content is rendered here -->
	{/if}
</main>

<footer>
	<p>© {new Date().getFullYear()} HiringHub. All rights reserved.</p>
</footer>

<style>
	/* Styles moved from App.svelte (keep them the same or adapt) */
    nav button.logout-link {
			/* Style button like a link */
			background: none;
			border: none;
			padding: 0;
			font: inherit;
			cursor: pointer;
			outline: inherit;
			/* Styling */
			margin-left: auto; /* Push logout link to the right */
			color: var(--error-text-color, #b91c1c);
			font-weight: 500;
			margin-right: var(--spacing-md, 24px); /* Match spacing */
    }
    nav button.logout-link:hover {
        color: var(--error-border-color, #fca5a5);
				text-decoration: underline;
    }
	nav {
		background-color: var(--surface-color, #f9fafb);
		padding: var(--spacing-sm, 16px) var(--spacing-md, 24px);
		border-bottom: 1px solid var(--border-color, #e5e7eb);
		margin-bottom: var(--spacing-lg, 32px);
        display: flex; /* Use flexbox for alignment */
        align-items: center;
	}

	nav a {
		margin-right: var(--spacing-md, 24px);
		font-weight: 500;
		color: var(--primary-color, #2563eb);
		text-decoration: none;
		cursor: pointer;
	}

	nav a:hover {
		text-decoration: underline;
		color: var(--secondary-color, #14b8a6);
	}

	main {
		/* Ensure main takes up space between nav and footer */
		flex-grow: 1;
		padding: 0 var(--spacing-md, 24px);
		/* min-height: calc(100vh - 150px); Remove fixed min-height */
	}

	footer {
		text-align: center;
		padding: var(--spacing-lg, 32px) var(--spacing-md, 24px);
		margin-top: var(--spacing-xl, 48px);
		border-top: 1px solid var(--border-color, #e5e7eb);
		color: var(--text-light-color, #6b7280);
		font-size: 0.9rem;
	}

	/* Ensure body takes full height for footer pushing */
	:global(body) {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}
	:global(#app) { /* Target the mount point if necessary */
		display: flex;
		flex-direction: column;
		flex-grow: 1;
	}

</style>
