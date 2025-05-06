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

		if (originalPathForThisLoad === null) {
			originalPathForThisLoad = window.location.pathname;
			console.log(`DEBUG onMount: originalPathForThisLoad CAPTURED as ${originalPathForThisLoad} at ${new Date().toISOString()}`);
		} else {
			console.log(`DEBUG onMount: originalPathForThisLoad already was ${originalPathForThisLoad}, current path ${window.location.pathname} at ${new Date().toISOString()}`);
		}
		
		// Call checkAuth() AFTER originalPathForThisLoad is potentially set.
		authStore.checkAuth(); 

		const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
			console.log(`DEBUG onAuthStateChange: Event: ${event}, Session User: ${session?.user?.id || 'null'}, Path: ${window.location.pathname} at ${new Date().toISOString()}`);
			authStore.setSession(session); // Update auth store
			await _handleAuthChange(event, session);
		});

		supabase.auth.getSession().then(({ data: { session } }) => {
			console.log(`DEBUG getSession CB: Session User: ${session?.user?.id || 'null'}, Path: ${window.location.pathname} at ${new Date().toISOString()}`);
			if (!session) {
				if ($userStore.loggedIn) {
					console.log("DEBUG getSession CB: No session, but store was loggedIn. Relying on onAuthStateChange to handle state and potential redirect.");
					// authStore.setSession(null); // onAuthStateChange should handle this
					// userStore.reset(); // onAuthStateChange should lead to this via _handleAuthChange(..., null)
				} else {
					console.log("DEBUG getSession CB: No session, store already reflects loggedOut. All good.");
				}
			} else {
				console.log("DEBUG getSession CB: Session exists. onAuthStateChange should process it or has already processed it.");
				// If onAuthStateChange has already set the session, this is just a confirmation.
				// Ensure authStore is updated if somehow onAuthStateChange was missed (unlikely)
				if ($authStore.session?.user.id !== session.user.id) {
					authStore.setSession(session);
				}
			}
		}).catch(error => {
            console.error("DEBUG getSession CB error:", error);
        });

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
		console.log(`DEBUG _handleAuthChange Invoked. Event: ${event}, originalPathForThisLoad: ${originalPathForThisLoad}, CurrentPath: ${currentPath}, Profile in store: ${$userStore.profile?.account_type || 'null'} at ${new Date().toISOString()}`);

		if (session && session.user) {
			let currentProfileData: Profile | null = $userStore.profile;
			let needsProfileFetch = !$userStore.profile || $userStore.profile.user_id !== session.user.id;

			if (needsProfileFetch) {
				profileLoading = true;
				try {
					console.log(`DEBUG _handleAuthChange: Fetching profile for user ${session.user.id}...`);
					const { data: profileData, error: profileError, status } = await supabase
						.from('profiles')
						.select('*')
						.eq('user_id', session.user.id)
						.maybeSingle();

					if (profileError && status !== 406) {
						console.error('Error fetching profile:', profileError);
						userStore.set({ loggedIn: true, session: session, user: session.user, profile: null });
						profileLoading = false;
						return; 
					}
					currentProfileData = profileData as Profile; // Update local var for subsequent logic in this call
					userStore.set({ loggedIn: true, session: session, user: session.user, profile: currentProfileData });
					console.log(`DEBUG _handleAuthChange: Profile fetched: ${currentProfileData?.account_type}`);
				} catch (e) {
					console.error('Exception fetching profile:', e);
					userStore.set({ loggedIn: true, session: session, user: session.user, profile: null });
					profileLoading = false;
					return;
				} finally {
					profileLoading = false;
				}
			} else {
				currentProfileData = $userStore.profile; // Ensure currentProfileData is set from store if no fetch needed
				console.log(`DEBUG _handleAuthChange: Profile from store: ${currentProfileData?.account_type}. Updating session/user info.`);
				userStore.update(current => ({ ...current, loggedIn: true, session: session, user: session.user }));
			}
			
			console.log(`DEBUG _handleAuthChange Redirection Logic Start. Event: ${event}, originalPathForThisLoad: ${originalPathForThisLoad}, CurrentPath: ${currentPath}, Profile Acquired: ${currentProfileData?.account_type}`);

			// Scenario 1: User refreshed on /messages (or intended to go there), and auth is now INITIAL_SESSION (or any event that provides a profile)
			// We use originalPathForThisLoad to know their initial intended page.
			if (originalPathForThisLoad === '/messages' && currentProfileData) {
				if (currentPath !== '/messages') {
					console.log(`DEBUG (S1): originalPathForThisLoad was /messages, now on ${currentPath}. Profile: ${currentProfileData.account_type}. Redirecting to /messages.`);
					await goto('/messages', { replaceState: true });
				} else {
					console.log(`DEBUG (S1): originalPathForThisLoad was /messages, still on /messages. Profile: ${currentProfileData.account_type}. Staying.`);
				}
				return; 
			}

			// Scenario 2: User is on /login or /register page, and profile just became available. This should run regardless of 'event' type if conditions met.
			if (currentProfileData && browser && (currentPath === '/login' || currentPath === '/register')) {
				console.log(`DEBUG (S2): On ${currentPath}, profile loaded (${currentProfileData.account_type}). Event: ${event}. Redirecting to profile page.`);
				if (currentProfileData.account_type === 'job_seeker') {
					await goto('/profile/job-seeker', { replaceState: true });
				} else if (currentProfileData.account_type === 'hiring_manager') {
					await goto('/profile/hiring-manager', { replaceState: true });
				} else { 
					await goto('/profile', { replaceState: true });
				}
				return; 
			}

			// Scenario 3: Standard SIGNED_IN event or INITIAL_SESSION (if S1 & S2 didn't apply)
			// This handles general cases, like logging in from /login, or initial load not on /messages.
			if (currentProfileData && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
				const targetProfilePath = currentProfileData.account_type === 'job_seeker' ? '/profile/job-seeker'
											: currentProfileData.account_type === 'hiring_manager' ? '/profile/hiring-manager'
											: '/profile';

				if (currentPath !== targetProfilePath && currentPath !== '/messages') { // Avoid redirect if already on target or on /messages (S1 would handle /messages restore)
					console.log(`DEBUG (S3): Event ${event}. On ${currentPath}, target ${targetProfilePath}. Profile type ${currentProfileData.account_type}. Redirecting.`);
					await goto(targetProfilePath, { replaceState: true });
					return;
				} else {
					console.log(`DEBUG (S3): Event ${event}. On ${currentPath}. Target ${targetProfilePath}. Profile type ${currentProfileData.account_type}. No S3 redirect needed (already on target, or on /messages which S1 should manage).`);
				}
			}
			
			console.log(`DEBUG _handleAuthChange End of logged-in logic. No redirection by S1,S2,S3 or S3 no-op. Event: ${event}, Path: ${currentPath}`);
			checkUnreadMessages();
		} else {
			// User is logged out (session is null)
			console.log(`DEBUG _handleAuthChange: User is logged out. Event: ${event}. Path: ${currentPath}. originalPathForThisLoad: ${originalPathForThisLoad}`);
			userStore.reset();
			unreadMessagesCount = 0;
			const protectedRoutes = ['/jobs/post', '/profile/hiring-manager', '/profile/job-seeker', '/messages'];
			const isProtectedRoute = protectedRoutes.some(route => currentPath.startsWith(route));

			if (isProtectedRoute && currentPath !== '/login') {
				console.log(`DEBUG _handleAuthChange: Logged out, on protected route ${currentPath}. Redirecting to /login.`);
				await goto('/login', { replaceState: true });
				return; 
			}
			console.log(`DEBUG _handleAuthChange: Logged out. Path: ${currentPath}. No redirect needed or already on /login.`);
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

	$: jobBoardLink = '/jobs/board'; // Updated to a more consistent route pattern
	$: postJobLink = '/jobs/post'; // Updated path to match our new route

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
