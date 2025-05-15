<script lang="ts">
	import { onMount } from 'svelte';
	import { supabase } from '$lib/supabaseClient';
	import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
	import { browser } from '$app/environment';
	import { goto } from '$app/navigation';
	import LoadingScreen from '$lib/components/LoadingScreen.svelte';
	import ThemeToggle from '$lib/components/ThemeToggle.svelte';
	import themeStore from '$lib/stores/themeStore';

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
	// State for mobile menu
	let isMobileMenuOpen = false;

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

		// Initialize theme
		themeStore.initialize();

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
						if (profileData) {
							if (currentPath === '/login' || currentPath === '/register') {
								// Determine the correct profile path based on account type
								const targetProfilePath = profileData.account_type === 'job_seeker' 
									? '/profile/job-seeker'
									: profileData.account_type === 'hiring_manager' 
										? '/profile/hiring-manager'
										: '/profile';
								
								console.log(`Redirecting to ${targetProfilePath} after login (Profile loaded)`);
								await goto(targetProfilePath, { replaceState: true });
							} 
							// Return user to their original page if they were redirected to login
							else if (currentPath === '/login' && originalPathForThisLoad && 
									 originalPathForThisLoad !== '/login' && 
									 !originalPathForThisLoad.includes('/reset-password')) {
								console.log(`Redirecting back to original path: ${originalPathForThisLoad}`);
								goto(originalPathForThisLoad, { replaceState: true });
							}
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
				if ($userStore.profile) {
					if (currentPath === '/login' || currentPath === '/register') {
						// Determine the correct profile path based on account type
						const targetProfilePath = $userStore.profile.account_type === 'job_seeker' 
							? '/profile/job-seeker'
							: $userStore.profile.account_type === 'hiring_manager' 
								? '/profile/hiring-manager'
								: '/profile';
						
						console.log(`Redirecting to ${targetProfilePath} after login (Profile already loaded)`);
						goto(targetProfilePath, { replaceState: true });
					}
					// Return user to their original page if they were redirected to login
					else if (currentPath === '/login' && originalPathForThisLoad && 
							 originalPathForThisLoad !== '/login' && 
							 !originalPathForThisLoad.includes('/reset-password')) {
						console.log(`Redirecting back to original path: ${originalPathForThisLoad}`);
						goto(originalPathForThisLoad, { replaceState: true });
					}
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

	// Toggle mobile menu
	function toggleMobileMenu() {
		isMobileMenuOpen = !isMobileMenuOpen;
	}

	// Handle keyboard navigation in mobile menu
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && isMobileMenuOpen) {
			isMobileMenuOpen = false;
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
	$: applicationsLink = '/profile/job-seeker/applications';
	
	// Added for accessibility - determine current page
	$: currentPath = browser ? window.location.pathname : '';
</script>

{#if $authStore.loading && !$authStore.error}
	<LoadingScreen message={profileLoading ? "Loading profile..." : "Processing authentication..."} />
{/if}

<div class="skip-to-content">
  <a href="#main-content" class="skip-link">Skip to main content</a>
</div>

<header>
	<nav aria-label="Main navigation">
		<div class="nav-container">
			<div class="nav-logo">
				<a href="/" class="nav-title" aria-label="HiringHub Home">HiringHub</a>
			</div>
			
			<button 
				class="mobile-menu-toggle" 
				aria-expanded={isMobileMenuOpen} 
				aria-controls="nav-menu"
				aria-label={isMobileMenuOpen ? "Close menu" : "Open menu"}
				on:click={toggleMobileMenu}
			>
				<span class="menu-icon"></span>
			</button>
			
			<div id="nav-menu" class={`nav-menu ${isMobileMenuOpen ? 'is-open' : ''}`} on:keydown={handleKeydown}>
				{#if $userStore.loggedIn}
					<!-- Logged-in user links -->
					<ul class="nav-links">
						<li>
							<a 
								href={profileLink} 
								aria-current={currentPath.includes('/profile') ? 'page' : undefined}
							>
								Profile
							</a>
						</li>
						<!-- Add links based on account type -->
						{#if $userStore.profile?.account_type === 'hiring_manager'}
							<li>
								<a 
									href={postJobLink} 
									aria-current={currentPath.includes('/jobs/post') ? 'page' : undefined}
								>
									Post Job
								</a>
							</li>
							<li>
								<a 
									href="/profile/hiring-manager/jobs" 
									aria-current={currentPath.includes('/profile/hiring-manager/jobs') ? 'page' : undefined}
								>
									Job Management
								</a>
							</li>
						{:else if $userStore.profile?.account_type === 'job_seeker'}
							<li>
								<a 
									href={jobBoardLink} 
									aria-current={currentPath.includes('/jobs/board') ? 'page' : undefined}
								>
									Job Board
								</a>
							</li>
							<li>
								<a 
									href={applicationsLink} 
									aria-current={currentPath.includes('/applications') ? 'page' : undefined}
								>
									Applications
								</a>
							</li>
						{/if}
						<!-- Add messages link for all users with unread notification -->
						<li>
							<a 
								href="/messages" 
								class="messages-link"
								aria-label={unreadMessagesCount > 0 ? `Messages (${unreadMessagesCount} unread)` : "Messages"}
								aria-current={currentPath.includes('/messages') ? 'page' : undefined}
							>
								Messages
								{#if unreadMessagesCount > 0}
									<span class="notification-badge" aria-hidden="true">{unreadMessagesCount}</span>
								{/if}
							</a>
						</li>
					</ul>
					
					<div class="nav-controls">
						<div class="theme-toggle-wrapper" aria-label="Theme toggle">
							<ThemeToggle />
						</div>
						<!-- Use a button for actions like logout -->
						<button type="button" class="logout-link" on:click={handleLogout}>
							Logout
						</button>
					</div>
				{:else}
					<!-- Logged-out user links -->
					<ul class="nav-links">
						<li>
							<a 
								href="/login" 
								aria-current={currentPath === '/login' ? 'page' : undefined}
							>
								Login
							</a>
						</li>
						<li>
							<a 
								href="/register" 
								aria-current={currentPath === '/register' ? 'page' : undefined}
							>
								Register
							</a>
						</li>
					</ul>
					
					<div class="nav-controls">
						<div class="theme-toggle-wrapper" aria-label="Theme toggle">
							<ThemeToggle />
						</div>
					</div>
				{/if}
			</div>
		</div>
	</nav>
</header>

<main id="main-content">
	{#if profileLoading && $userStore.loggedIn}
		<div role="status" aria-live="polite">
			<p>Loading user profile...</p>
		</div>
	{:else}
		<slot /> <!-- Page content is rendered here -->
	{/if}
</main>

<footer role="contentinfo">
	<div class="footer-content">
		<p>&copy; {new Date().getFullYear()} HiringHub. All rights reserved.</p>
		<nav aria-label="Footer navigation">
			<ul class="footer-links">
				<li><a href="/pages/about">About</a></li>
				<li><a href="/pages/privacy-policy">Privacy Policy</a></li>
				<li><a href="/pages/terms">Terms of Service</a></li>
			</ul>
		</nav>
	</div>
</footer>

<style>
	/* Improved accessibility styles */
	:global(.skip-link) {
		position: absolute;
		top: -40px;
		left: 0;
		background: var(--primary-color);
		color: white;
		padding: 8px;
		z-index: 100;
		transition: top 0.1s ease-in;
	}
	
	:global(.skip-link:focus) {
		top: 0;
	}
	
	header {
		background-color: var(--surface-color, #f9fafb);
		border-bottom: 1px solid var(--border-color, #d1d5db);
		margin-bottom: var(--spacing-lg, 32px);
	}
	
	/* Updated navigation styles */
	nav {
		padding: var(--spacing-sm, 16px) var(--spacing-md, 24px);
	}
	
	.nav-container {
		display: flex;
		align-items: center;
		justify-content: space-between;
		max-width: 1200px;
		margin: 0 auto;
		position: relative;
	}
	
	.nav-logo {
		display: flex;
		align-items: center;
	}
	
	.nav-title {
		font-size: 1.5rem;
		font-weight: 700;
		color: var(--primary-color);
		text-decoration: none;
	}
	
	.nav-title:focus {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	
	.nav-menu {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-grow: 1;
		margin-left: var(--spacing-lg);
	}
	
	.nav-links {
		display: flex;
		list-style: none;
		gap: var(--spacing-md);
		margin: 0;
		padding: 0;
	}
	
	.nav-links a {
		font-weight: 500;
		color: var(--primary-color, #0d47a1);
		text-decoration: none;
		padding: var(--spacing-xs) var(--spacing-sm);
		border-radius: var(--border-radius);
	}
	
	.nav-links a:hover {
		text-decoration: underline;
		color: var(--primary-color-dark, #002171);
	}
	
	.nav-links a:focus {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}
	
	.nav-links a[aria-current="page"] {
		font-weight: 700;
		border-bottom: 2px solid var(--primary-color);
	}
	
	.nav-controls {
		display: flex;
		align-items: center;
		gap: var(--spacing-md);
	}
	
	/* Mobile menu toggle */
	.mobile-menu-toggle {
		display: none;
		background: none;
		border: none;
		width: 40px;
		height: 40px;
		position: relative;
		cursor: pointer;
		z-index: 20;
	}
	
	.menu-icon {
		display: block;
		position: relative;
		width: 24px;
		height: 2px;
		background-color: var(--primary-color);
		margin: 0 auto;
		transition: background-color 0.3s;
	}
	
	.menu-icon::before,
	.menu-icon::after {
		content: '';
		position: absolute;
		width: 24px;
		height: 2px;
		background-color: var(--primary-color);
		transition: transform 0.3s;
	}
	
	.menu-icon::before {
		top: -6px;
	}
	
	.menu-icon::after {
		bottom: -6px;
	}

	[aria-expanded="true"] .menu-icon {
		background-color: transparent;
	}
	
	[aria-expanded="true"] .menu-icon::before {
		transform: rotate(45deg);
		top: 0;
	}
	
	[aria-expanded="true"] .menu-icon::after {
		transform: rotate(-45deg);
		bottom: 0;
	}

	/* Logout button style with accessibility */
	nav button.logout-link {
		background: none;
		border: none;
		padding: var(--spacing-xs) var(--spacing-sm);
		font: inherit;
		cursor: pointer;
		color: var(--error-text-color, #9b0000);
		font-weight: 500;
		border-radius: var(--border-radius);
	}
	
	nav button.logout-link:hover {
		color: var(--error-border-color, #fca5a5);
		text-decoration: underline;
	}
	
	nav button.logout-link:focus {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}

	/* Messages notification */
	.messages-link {
		position: relative;
		padding-right: 20px;
	}
	
	.notification-badge {
		position: absolute;
		top: -6px;
		right: 0;
		background-color: var(--error-text-color, #9b0000);
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
	
	/* Theme Toggle styles */
	.theme-toggle-wrapper {
		display: flex;
		align-items: center;
	}

	/* Main content area */
	main {
		flex-grow: 1;
		padding: 0 var(--spacing-md, 24px);
		max-width: 1200px;
		margin: 0 auto;
		width: 100%;
	}

	/* Footer styles */
	footer {
		background-color: var(--surface-color);
		padding: var(--spacing-lg, 32px) var(--spacing-md, 24px);
		margin-top: var(--spacing-xl, 48px);
		border-top: 1px solid var(--border-color, #d1d5db);
		color: var(--text-light-color, #606770);
	}
	
	.footer-content {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: var(--spacing-md);
		max-width: 1200px;
		margin: 0 auto;
	}
	
	.footer-links {
		display: flex;
		list-style: none;
		gap: var(--spacing-lg);
		margin: 0;
		padding: 0;
	}
	
	.footer-links a {
		color: var(--text-muted-color);
		text-decoration: none;
	}
	
	.footer-links a:hover {
		text-decoration: underline;
		color: var(--primary-color);
	}
	
	.footer-links a:focus {
		outline: var(--focus-ring-width) solid var(--focus-ring-color);
		outline-offset: var(--focus-ring-offset);
	}

	/* Ensure body takes full height for footer pushing */
	:global(body) {
		display: flex;
		flex-direction: column;
		min-height: 100vh;
	}
	
	:global(#svelte) {
		display: flex;
		flex-direction: column;
		flex-grow: 1;
	}
	
	/* Responsive styles */
	@media (max-width: 768px) {
		.mobile-menu-toggle {
			display: block;
		}
		
		.nav-menu {
			position: fixed;
			top: 0;
			right: -100%;
			width: 80%;
			max-width: 300px;
			height: 100vh;
			background-color: var(--surface-color);
			flex-direction: column;
			justify-content: flex-start;
			gap: var(--spacing-xl);
			padding: 80px var(--spacing-md) var(--spacing-md);
			box-shadow: var(--box-shadow-lg);
			transition: right 0.3s ease;
			z-index: 10;
			margin-left: 0;
		}
		
		.nav-menu.is-open {
			right: 0;
		}
		
		.nav-links {
			flex-direction: column;
			width: 100%;
		}
		
		.nav-links a {
			display: block;
			padding: var(--spacing-sm);
		}
		
		.nav-controls {
			flex-direction: column;
			align-items: flex-start;
		}
		
		.footer-content {
			text-align: center;
		}
		
		.footer-links {
			flex-direction: column;
			gap: var(--spacing-sm);
		}
	}
</style>
