<script lang="ts">
  import { onMount } from 'svelte';
  import userStore from '$lib/stores/userStore'; // Updated path
  import { supabase } from '$lib/supabaseClient'; // Updated path
  import { get } from 'svelte/store';
  import { browser } from '$app/environment'; // Check if running in browser

  // Local state for form bindings
  let fullName = '';
  let companyName = '';
  let location = '';
  // let website = ''; // Personal website not in this form
  let companyWebsite = '';

  // UI state
  let editMode = false; // Default to view mode
  let loading = true;
  let profileLoadAttempted = false;
  let isCorrectProfileType = false;
  let profileIsDefinitelyNull = false;
  let creatingNewProfile = false; // For first-time profile creation
  let isNewUser = false; // Flag to show first-time user welcome message
  let message = '';
  let messageType: 'success' | 'error' = 'error';

	// Helper function to initialize form data
	function initializeFormData(profile: any) {
		if (profile) {
			fullName = profile.full_name || '';
			companyName = profile.company_name || '';
			location = profile.location || '';
			// website = profile.website || ''; // Personal website not in this form
			companyWebsite = profile.company_website || '';
		} else {
			// Clear form if profile is null
			fullName = '';
			companyName = '';
			location = '';
			companyWebsite = '';
		}
	}

  // Toggle between view and edit modes
  function toggleEditMode() {
    editMode = !editMode;
    // Clear any messages when toggling modes
    message = '';
  }

  // Check if profile is essentially empty and needs completing
  function isEmptyProfile(profile: any): boolean {
    // Check if essential fields are empty
    return !profile.full_name || 
           !profile.company_name || 
           (!profile.company_website && !profile.location);
  }

  // Create separate async function for profile initialization
  async function initializeProfile() {
    const initialValue = get(userStore);
    if (!initialValue.loggedIn) {
      loading = false; // Not logged in on mount
    } else if (initialValue.profile) {
      // If profile state (data) is already known on mount
			loading = false;
			profileLoadAttempted = true;
			if (initialValue.profile.account_type === 'hiring_manager'){
				isCorrectProfileType = true;
				initializeFormData(initialValue.profile);
				// If new user or profile is incomplete, start in edit mode
				editMode = isEmptyProfile(initialValue.profile);
			} else {
				isCorrectProfileType = false;
			}
    } else if (initialValue.profile === null && initialValue.user) {
      // Profile is null but user is logged in - check if we need to create one
      const { data: existingProfile, error: checkError } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', initialValue.user.id)
        .maybeSingle();
      
      if (!existingProfile && !checkError) {
        isNewUser = true;
        // Create a basic profile for new user
        creatingNewProfile = true;
        editMode = true; // Start in edit mode for new users
        try {
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              user_id: initialValue.user.id,
              account_type: 'hiring_manager',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .select()
            .single();
          
          if (createError) throw createError;
          
          // Update the store with the new profile
          userStore.set({
            loggedIn: true,
            session: initialValue.session,
            user: initialValue.user,
            profile: newProfile
          });
          
          isCorrectProfileType = true;
          profileIsDefinitelyNull = false;
          message = "Welcome! Please complete your company profile information below.";
          messageType = "success";
        } catch (error) {
          console.error('Error creating initial profile:', error);
          message = "There was an error setting up your profile. Please try refreshing.";
          messageType = "error";
        } finally {
          creatingNewProfile = false;
          loading = false;
        }
      } else {
        // Profile explicitly null and doesn't need creation
        loading = false;
        profileLoadAttempted = true;
        isCorrectProfileType = false;
        profileIsDefinitelyNull = true;
      }
    }
  }

  // Subscribe to user store changes only in the browser
	let unsubscribeUserStore: (() => void) | null = null;
	if (browser) {
		unsubscribeUserStore = userStore.subscribe(value => {
			if (value.loggedIn) {
				if (value.profile === undefined) {
					// Store potentially initializing, keep loading
					loading = true;
					profileLoadAttempted = false;
					isCorrectProfileType = false;
					profileIsDefinitelyNull = false;
				} else if (value.profile === null) {
					// Profile confirmed as null
					loading = false;
					profileLoadAttempted = true;
					isCorrectProfileType = false;
					profileIsDefinitelyNull = true;
				} else {
					// Profile exists in the store
					loading = false;
					profileLoadAttempted = true;
					profileIsDefinitelyNull = false;
					if (value.profile.account_type === 'hiring_manager') {
						// Correct type
						isCorrectProfileType = true;
						initializeFormData(value.profile);
					} else {
						// Wrong type
						isCorrectProfileType = false;
					}
				}
			} else {
				// Not logged in, reset state
				loading = false;
				profileLoadAttempted = false;
				isCorrectProfileType = false;
				profileIsDefinitelyNull = false;
				initializeFormData(null); // Clear form fields
			}
		});
	}

  onMount(() => {
    // Call the async initialization function
    initializeProfile();
    
    // Return cleanup function
    return () => {
			if (unsubscribeUserStore) {
				unsubscribeUserStore(); // Cleanup subscription
			}
		};
  });

  async function handleProfileUpdate() {
    const currentUser = get(userStore).user;
    if (!currentUser) {
      message = 'You must be logged in to update your profile.';
      messageType = 'error';
      return;
    }

    // Basic URL validation (optional)
    if (companyWebsite && !companyWebsite.startsWith('http')) {
        message = 'Please enter a valid URL for the company website (e.g., https://yourcompany.com).';
        messageType = 'error';
        return;
    }

    loading = true;
    message = '';
    try {
      const updates = {
        full_name: fullName,
        company_name: companyName,
        location: location,
        // website: website, // Personal website not updated here
        company_website: companyWebsite,
        updated_at: new Date().toISOString(), // Convert Date to string for compatibility
      };

      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('user_id', currentUser.id);

      if (error) throw error;

      userStore.updateProfile(updates); // Update store locally

      message = isNewUser 
        ? 'Company profile created successfully! You can now post job listings.' 
        : 'Profile updated successfully!';
      isNewUser = false; // Reset new user flag
      messageType = 'success';
      editMode = false; // Switch back to view mode after successful save

    } catch (error: any) {
      console.error('Error updating profile:', error);
      message = `Error updating profile: ${error.message}`;
      messageType = 'error';
    } finally {
      loading = false;
    }
  }

</script>

<div class="container profile-page">
  <h2>Your Profile</h2>

  {#if !$userStore.loggedIn}
    <p>Please <a href="/login">log in</a> to view your profile.</p>
  {:else if loading || creatingNewProfile}
    <p>Loading profile...</p>
  {:else if !isCorrectProfileType && !isNewUser}
    <!-- Error state: Covers wrong type AND profile fetch completed as null -->
    <p class="message error">
      {#if profileIsDefinitelyNull}
        Your hiring manager profile data could not be loaded. It might not exist yet or there was an error.
        Please try refreshing the page. If the problem persists, contact support.
      {:else if profileLoadAttempted}
        Could not display profile. Your account type might not be 'hiring_manager' or the profile data is missing.
				{#if $userStore.profile?.account_type === 'job_seeker'}
						You are currently logged in as a Job Seeker. <a href="/profile/job-seeker">View Job Seeker Profile</a>.
				{/if}
      {:else}
        There was an issue loading your profile. Please try again later.
      {/if}
    </p>
  {:else}
    <!-- Profile loaded and correct type -->
    {#if message}
      <p class="message {messageType}">{message}</p>
    {/if}

    {#if isNewUser}
      <div class="welcome-box">
        <h3>Welcome to HiringHub!</h3>
        <p>Complete your company profile to start posting jobs and finding talented candidates.</p>
      </div>
    {/if}

    <!-- VIEW MODE -->
    {#if !editMode}
      <div class="profile-view">
        <div class="profile-header">
          <div class="profile-info">
            <h3>{companyName || 'Your Company'}</h3>
            {#if fullName}
              <p class="headline">Hiring Manager: {fullName}</p>
            {/if}
            {#if location}
              <p class="location"><i class="location-icon">📍</i> {location}</p>
            {/if}
          </div>
          <button class="btn-secondary edit-profile-btn" on:click={toggleEditMode}>Edit Profile</button>
        </div>

        {#if companyWebsite}
          <div class="profile-section">
            <h4>Company Website</h4>
            <p>
              <a href={companyWebsite} target="_blank" rel="noopener noreferrer">
                <span class="link-icon">🔗</span> {companyWebsite}
              </a>
            </p>
          </div>
        {/if}

        <!-- Job Management Section -->
        <div class="profile-section job-management">
          <h4>Job Management</h4>
          <div class="job-actions">
            <a href="/jobs/post" class="btn-primary">
              <span class="action-icon">➕</span> Post New Job
            </a>
            <a href="/profile/hiring-manager/jobs" class="btn-secondary">
              <span class="action-icon">📋</span> Manage Job Listings
            </a>
          </div>
        </div>

        <!-- Empty state for incomplete profiles -->
        {#if !fullName && !companyName && !location && !companyWebsite}
          <div class="profile-empty">
            <p>Your company profile is waiting to be completed. Click "Edit Profile" to add your information.</p>
          </div>
        {/if}
      </div>
    {:else}
      <!-- EDIT MODE - Form -->
      <form on:submit|preventDefault={handleProfileUpdate} class="profile-form">
        <div class="form-group">
          <label for="hmFullName">Full Name*</label>
          <input id="hmFullName" type="text" bind:value={fullName} placeholder="Your Name" disabled={loading} required={isNewUser} />
          {#if isNewUser}<small>Your name as the hiring manager</small>{/if}
        </div>

        <div class="form-group">
          <label for="hmCompanyName">Company Name*</label>
          <input id="hmCompanyName" type="text" bind:value={companyName} placeholder="Your Company Inc." disabled={loading} required={isNewUser} />
          <small>The name of your company that will appear on job listings</small>
        </div>

        <div class="form-group">
          <label for="hmCompanyWebsite">Company Website</label>
          <input id="hmCompanyWebsite" type="url" bind:value={companyWebsite} placeholder="https://yourcompany.com" disabled={loading} />
          <small>URL to your company website (helps candidates learn more)</small>
        </div>

        <div class="form-group">
          <label for="hmLocation">Company Location</label>
          <input id="hmLocation" type="text" bind:value={location} placeholder="City, Country" disabled={loading} />
          <small>Primary location of your company or hiring office</small>
        </div>

        <div class="form-actions">
          <button type="button" class="btn-secondary" on:click={toggleEditMode} disabled={loading}>
            Cancel
          </button>
          <button type="submit" class="btn-primary" disabled={loading}>
            {#if loading}Saving...
            {:else if isNewUser}Create Company Profile
            {:else}Save Changes{/if}
          </button>
        </div>
      </form>
    {/if}
  {/if}
</div>

<style>
  /* Styles can be largely reused from JobSeekerProfile */
  .profile-page {
    max-width: 800px;
    margin: var(--spacing-lg) auto;
  }

  /* VIEW MODE STYLES */
  .profile-view {
    margin-top: var(--spacing-lg);
    padding: var(--spacing-lg);
    background-color: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
  }

  .profile-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--spacing-lg);
    padding-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--border-color);
  }

  .profile-info h3 {
    margin: 0 0 var(--spacing-xs) 0;
    font-size: 1.5em;
  }

  .headline {
    font-size: 1.1em;
    color: var(--text-muted-color);
    margin: var(--spacing-xs) 0;
  }

  .location {
    display: flex;
    align-items: center;
    font-size: 0.9em;
    color: var(--text-light-color);
    margin: var(--spacing-xs) 0;
  }

  .location-icon {
    margin-right: var(--spacing-xs);
    font-style: normal;
  }

  .profile-section {
    margin-bottom: var(--spacing-lg);
  }

  .profile-section h4 {
    margin-bottom: var(--spacing-sm);
    color: var(--text-color);
    font-weight: 600;
  }

  .link-icon {
    margin-right: var(--spacing-xs);
  }

  .profile-empty {
    text-align: center;
    padding: var(--spacing-lg);
    background-color: var(--surface-secondary-color, #f3f4f6);
    border-radius: var(--border-radius);
    color: var(--text-muted-color);
  }

  /* EDIT MODE & FORM STYLES */
  .profile-form {
    margin-top: var(--spacing-lg);
    padding: var(--spacing-lg);
    background-color: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
  }

  .welcome-box {
    background-color: var(--primary-color-light, #e0f2fe);
    border: 1px solid var(--primary-color, #2563eb);
    border-radius: var(--border-radius);
    padding: var(--spacing-md);
    margin-bottom: var(--spacing-lg);
    text-align: center;
  }

  .welcome-box h3 {
    color: var(--primary-color-dark, #1e40af);
    margin-top: 0;
  }

  .form-group {
    margin-bottom: var(--spacing-lg);
  }

  .form-group label {
    display: block;
    margin-bottom: var(--spacing-xs);
    font-weight: 500;
  }

  .form-group input,
  .form-group textarea { /* Keep textarea style in case needed later */
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    font-size: var(--font-size-base);
    background-color: var(--input-bg-color, var(--surface-color));
    color: var(--text-color);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

  .form-group input:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.2);
  }

  .form-group small {
    display: block;
    margin-top: var(--spacing-xs);
    color: var(--text-muted-color);
    font-size: var(--font-size-sm);
  }

  .message {
    padding: var(--spacing-sm) var(--spacing-md);
    margin-bottom: var(--spacing-md);
    border-radius: var(--border-radius);
    text-align: center;
    font-size: var(--font-size-sm);
    border: 1px solid transparent;
  }

  .message.error {
    background-color: var(--error-bg-color, #fee2e2);
    color: var(--error-text-color, #b91c1c);
    border-color: var(--error-border-color, #fca5a5);
  }

  .message.success {
    background-color: var(--success-bg-color, #dcfce7);
    color: var(--success-text-color, #166534);
    border-color: var(--success-border-color, #86efac);
  }

  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-md);
  }

  .btn-primary {
    padding: var(--spacing-sm) var(--spacing-lg);
    background-color: var(--primary-color);
    color: var(--primary-contrast-color);
    border: none;
    border-radius: var(--border-radius);
    cursor: pointer;
    font-size: var(--font-size-base);
    font-weight: 500;
    transition: background-color 0.2s ease;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: var(--primary-color-dark);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .btn-secondary {
    padding: var(--spacing-sm) var(--spacing-lg);
    background-color: var(--background-color, white);
    color: var(--text-color);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    cursor: pointer;
    font-size: var(--font-size-base);
    font-weight: 500;
    transition: background-color 0.2s ease, border-color 0.2s ease;
  }

  .btn-secondary:hover:not(:disabled) {
    background-color: var(--background-hover-color, #f9fafb);
    border-color: var(--text-muted-color);
  }

  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .edit-profile-btn {
    border: 2px solid var(--primary-color);
    color: var(--primary-color);
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 0.5em;
  }
  
  .edit-profile-btn::before {
    content: "✏️";
    font-size: 1.1em;
  }
  
  .edit-profile-btn:hover {
    background-color: var(--primary-color-light, #e0f2fe);
    border-color: var(--primary-color-dark, #1e40af);
  }

  a {
    color: var(--primary-color);
    text-decoration: underline;
  }
  
  /* Job Management Styles */
  .job-management {
    margin-top: var(--spacing-lg);
  }
  
  .job-actions {
    display: flex;
    gap: var(--spacing-md);
    margin-top: var(--spacing-sm);
  }
  
  .job-actions .btn-primary,
  .job-actions .btn-secondary {
    text-decoration: none;
    display: flex;
    align-items: center;
    gap: 0.5em;
    padding: var(--spacing-sm) var(--spacing-md);
  }
  
  /* Make the Manage Job Listings button more visible */
  .job-actions .btn-secondary {
    border-width: 2px;
    border-color: var(--primary-color-light, #93c5fd);
    position: relative;
    font-weight: 500;
  }
  
  .job-actions .btn-secondary:hover {
    border-color: var(--primary-color, #2563eb);
    background-color: var(--primary-color-light, #e0f2fe);
  }
  
  .action-icon {
    font-size: 1.1em;
  }
</style> 