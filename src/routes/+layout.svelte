<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import LoadingScreen from '$lib/components/LoadingScreen.svelte';

	// Import global styles
	import "../app.css"; // Use relative path from routes directory

	// Stores (adjust path if necessary)
	import userStore, { type Profile } from '$lib/stores/userStore'; // Import the user store
	import authStore from '$lib/stores/authStore'; // Import the new auth store

	// State for profile fetching indicator (could be useful)
	let profileLoading = false;
	// State for unread messages count
	let unreadMessagesCount = 0;
	let originalPathForThisLoad: string | null = null; // Renamed and will be set once

	// Function to check for unread messages
	async function checkUnreadMessages() {
		if (!browser || !$userStore.loggedIn || !$userStore.user) return;
		
		try {
			// Determine if user is a hiring manager or job seeker
			const isHiringManager = $userStore.profile?.account_type === 'hiring_manager';
			const queryField = isHiringManager ? 'hiring_manager_id' : 'job_seeker_id';
			const userId = $userStore.user.id;
			const { data: chats, error: chatsError } = await supabase
						.from('chats')
						.select('id')
						.eq(queryField, userId)
			
			// Simplified query that combines both steps
			const { count, error } = await supabase
				.from('messages')
				.select('*', { count: 'exact', head: true })
				.neq('sender_id', userId)
				.is('read_at', null)
				.in('chat_id', 
					chats?.map(chat => chat.id) || []
				);
			
			if (error) throw error;
			
			// Update the unread count
			unreadMessagesCount = count || 0;
			// console.log(`Unread messages count: ${unreadMessagesCount}`); // Kept original console log commented
			
		} catch (error) {
			console.error('Error checking unread messages:', error);
		}
	}

	onMount(() => {
		if (!browser) return;

		// Set the original path for this page load - important for redirect handling
		if (originalPathForThisLoad === null) {
			originalPathForThisLoad = window.location.pathname;
			console.log(`Setting originalPathForThisLoad to ${originalPathForThisLoad}`);
		}
		
		// Initialize auth state
		authStore.checkAuth(); 

		// Listen for auth state changes
		const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
			console.log(`Auth state changed: ${event}`);
			
			// Update auth store first
			if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
				authStore.setSession(session);
				authStore.setLoading(true); // Start loading state
			} else if (event === 'SIGNED_OUT') {
				authStore.setSession(null);
				userStore.reset();
			}
			
			// Then handle the auth change with our custom logic
			await _handleAuthChange(event, session);
		});

		// Set up real-time message notifications
		const messagesChannel = supabase
			.channel('global-unread-messages')
			.on('postgres_changes', 
				{ event: 'INSERT', schema: 'public', table: 'messages' }, 
				(payload) => {
					console.log('New message detected globally:', payload);
					if (payload.new && payload.new.sender_id !== $userStore.user?.id) {
						checkUnreadMessages();
					}
				})
			.on('postgres_changes',
				{ event: 'UPDATE', schema: 'public', table: 'messages', filter: `read_at=is.not.null` },
				() => { checkUnreadMessages(); })
			.subscribe((status) => {
				console.log(`Global message channel status: ${status}`);
				if (status === 'SUBSCRIBED') {
					checkUnreadMessages();
				}
			});
		
		checkUnreadMessages();
		
		return () => {
			authListener?.subscription.unsubscribe();
			supabase.removeChannel(messagesChannel);
		};
	});

	async function _handleAuthChange(event: AuthChangeEvent, session: Session | null) {
		const currentPath = browser ? window.location.pathname : '';
		console.log(`Auth change: ${event}, Path: ${currentPath}, Original: ${originalPathForThisLoad}`);

		if (session && session.user) {
			// User is signed in
			let needsProfileFetch = !$userStore.profile || $userStore.profile.user_id !== session.user.id;

			if (needsProfileFetch) {
				profileLoading = true;
				try {
					console.log('Fetching profile...');
					const { data: profileData, error: profileError, status } = await supabase
						.from('profiles')
						.select('*')
						.eq('user_id', session.user.id)
						.maybeSingle();

					if (profileError && status !== 406) {
						console.error('Error fetching profile:', profileError);
						userStore.set({ loggedIn: true, session: session, user: session.user, profile: null });
					} else {
						userStore.set({ loggedIn: true, session: session, user: session.user, profile: profileData });
						console.log(`Profile loaded: ${profileData?.account_type || 'null'}`);
						
						// Handle redirection AFTER profile is loaded successfully
						if (profileData && (currentPath === '/login' || currentPath === '/register')) {
							// Determine the correct profile path based on account type
							const targetProfilePath = profileData.account_type === 'job_seeker' 
								? '/profile/job-seeker'
								: profileData.account_type === 'hiring_manager' 
									? '/profile/hiring-manager'
									: '/profile';
							
							console.log(`Redirecting to ${targetProfilePath} after login (Profile loaded)`);
							await goto(targetProfilePath, { replaceState: true });
						}
					}
				} catch (e) {
					console.error('Exception fetching profile:', e);
					userStore.set({ loggedIn: true, session: session, user: session.user, profile: null });
				} finally {
					profileLoading = false;
					authStore.setLoading(false); // End loading state after profile load
				}
			} else {
				// Profile already loaded, just update session/user info
				userStore.update(current => ({ ...current, loggedIn: true, session: session, user: session.user }));
				authStore.setLoading(false); // End loading state
				
				// Check if we need to redirect even with already loaded profile
				if ($userStore.profile && (currentPath === '/login' || currentPath === '/register')) {
					// Determine the correct profile path based on account type
					const targetProfilePath = $userStore.profile.account_type === 'job_seeker' 
						? '/profile/job-seeker'
						: $userStore.profile.account_type === 'hiring_manager' 
							? '/profile/hiring-manager'
							: '/profile';
					
					console.log(`Redirecting to ${targetProfilePath} after login (Profile already loaded)`);
					goto(targetProfilePath, { replaceState: true });
				}
			}
			
			checkUnreadMessages();
		} else {
			// User is logged out
			console.log('User is logged out');
			userStore.reset();
			unreadMessagesCount = 0;
			authStore.setLoading(false);
			
			// Redirect from protected routes
			const protectedRoutes = ['/jobs/post', '/profile/hiring-manager', '/profile/job-seeker', '/messages'];
			const isProtectedRoute = protectedRoutes.some(route => currentPath.startsWith(route));

			if (isProtectedRoute && currentPath !== '/login') {
				console.log(`Redirecting to /login from protected route ${currentPath}`);
				goto('/login', { replaceState: true });
			}
		}
	}

	// Logout function
	async function handleLogout() {
		authStore.setLoading(true);
		try {
			await authStore.logout();
			userStore.reset();
			await goto('/', { replaceState: true });
		} catch (error) {
			console.error("Error during logout:", error);
		} finally {
			authStore.setLoading(false);
		}
	}

	// Determine profile link based on account type
	$: profileLink = $userStore.profile?.account_type === 'job_seeker'
		? '/profile/job-seeker'
		: $userStore.profile?.account_type === 'hiring_manager'
			? '/profile/hiring-manager' 
			: $userStore.loggedIn 
				? '/profile' 
				: '/login'; 

	$: jobBoardLink = '/jobs/board';
	$: postJobLink = '/jobs/post';
</script>

{#if $authStore.loading}
	<LoadingScreen />
{/if}

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
		<!-- Add messages link for all users with unread notification -->
		<a href="/messages" class="messages-link">
			Messages
			{#if unreadMessagesCount > 0}
				<span class="notification-badge">{unreadMessagesCount}</span>
			{/if}
		</a>
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

	.messages-link {
        position: relative;
        padding-right: 8px;
    }
    
    .notification-badge {
        position: absolute;
        top: -6px;
        right: -6px;
        background-color: var(--error-text-color, #b91c1c);
        color: white;
        border-radius: 50%;
        font-size: 0.7rem;
        width: 18px;
        height: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: bold;
    }

</style>
