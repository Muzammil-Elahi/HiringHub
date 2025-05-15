<script lang="ts">
  import { onMount } from 'svelte';
  import userStore from '$lib/stores/userStore'; // Updated path
  import { supabase } from '$lib/supabaseClient'; // Updated path
  import { get } from 'svelte/store';
  import { browser } from '$app/environment'; // Check if running in browser

  // Local state for form bindings
  let fullName = '';
  let headline = '';
  let bio = '';
  let location = '';
  let linkedinUrl = '';
  let resumeUrl = '';
  let resumeFilename = '';

  // UI state
  let editMode = false; // Default to view mode
  let loading = true; // For overall profile loading
  let uploadingResume = false; // Specific loading state for resume upload
  let creatingNewProfile = false; // For first-time profile creation
  let isNewUser = false; // Flag to show first-time user welcome message

  let profileLoadAttempted = false;
  let isCorrectProfileType = false;
  let profileIsDefinitelyNull = false; // Track if fetch completed and profile is null

  let message = '';
  let messageType: 'error' | 'success' | 'info' = 'error';
  
  // Form field references for managing focus
  let fullNameInput: HTMLInputElement;
  let messageTimeout: ReturnType<typeof setTimeout> | null = null;

	// Helper function to initialize form data
	function initializeFormData(profile: any) {
		  if (profile) {
				fullName = profile.full_name || '';
				headline = profile.headline || '';
				bio = profile.bio || '';
				location = profile.location || '';
				linkedinUrl = profile.linkedin_url || '';
				resumeUrl = profile.resume_url || '';
        resumeFilename = profile.resume_filename || 'Resume';
			}
	}

  // Toggle between view and edit modes
  function toggleEditMode() {
    editMode = !editMode;
    // Clear any messages when toggling modes
    message = '';
    
    // When switching to edit mode, focus on the first input after render
    if (editMode) {
      setTimeout(() => {
        if (fullNameInput) {
          fullNameInput.focus();
        }
      }, 0);
    }
  }

  // Create separate async function for profile initialization
  async function initializeProfile() {
    const initialValue = get(userStore);
    if (!initialValue.loggedIn) {
      loading = false;
    } else if (initialValue.profile) {
			// If profile state (data) is already known on mount
			loading = false;
			profileLoadAttempted = true;
			if (initialValue.profile.account_type === 'job_seeker') {
				isCorrectProfileType = true;
				initializeFormData(initialValue.profile);
				// If new user or profile is incomplete, start in edit mode
				editMode = isEmptyProfile(initialValue.profile);
			} else {
				isCorrectProfileType = false;
			}
		} else if (initialValue.profile === null && initialValue.user) {
      // Profile is null but user is logged in - this could be a new user
      // Check if we need to create a profile
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
              account_type: 'job_seeker',
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
          message = "Welcome! Please complete your profile information below.";
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
        // Finished load attempt - profile is null
        loading = false;
        profileLoadAttempted = true;
        isCorrectProfileType = false;
        profileIsDefinitelyNull = true;
      }
    }
  }

  // Check if profile is essentially empty and needs completing
  function isEmptyProfile(profile: any): boolean {
    // Check if essential fields are empty
    return !profile.full_name || 
           (!profile.headline && !profile.bio && !profile.location);
	}

	// Subscribe to user store changes only in the browser
	let unsubscribeUserStore: (() => void) | null = null;
	if (browser) {
		unsubscribeUserStore = userStore.subscribe(value => {
			if (value.loggedIn) {
				if (value.profile === undefined) {
					loading = true;
					profileLoadAttempted = false;
					isCorrectProfileType = false;
					profileIsDefinitelyNull = false;
				} else if (value.profile === null) {
					loading = false;
					profileLoadAttempted = true;
					isCorrectProfileType = false;
					profileIsDefinitelyNull = true;
				} else {
					loading = false;
					profileLoadAttempted = true;
					profileIsDefinitelyNull = false;
					if (value.profile.account_type === 'job_seeker') {
						isCorrectProfileType = true;
						initializeFormData(value.profile);
					} else {
						isCorrectProfileType = false;
					}
				}
			} else {
				loading = false;
				profileLoadAttempted = false;
				isCorrectProfileType = false;
				profileIsDefinitelyNull = false;
				initializeFormData(null); // Clear form if logged out
			}
		});
	}

  onMount(() => {
    // Call the async initialization function
    initializeProfile();
    
    // Return cleanup function
    return () => {
			if (unsubscribeUserStore) {
				unsubscribeUserStore();
			}
      
      // Clear any pending timeouts
      if (messageTimeout) {
        clearTimeout(messageTimeout);
      }
    };
  });

  // Handle auto-dismissing messages
  function setTempMessage(msg: string, type: 'error' | 'success' | 'info' = 'success', duration = 5000) {
    message = msg;
    messageType = type;
    
    // Clear any existing timeout
    if (messageTimeout) {
      clearTimeout(messageTimeout);
    }
    
    // Auto-clear message after duration
    messageTimeout = setTimeout(() => {
      message = '';
    }, duration);
  }

  async function handleResumeUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) {
        setTempMessage('No file selected.', 'error');
        return;
    }

    const currentUser = get(userStore).user;
    if (!currentUser) {
        setTempMessage('You must be logged in to upload a resume.', 'error');
        return;
    }

    // Basic file type check - ONLY PDF
    const allowedTypes = ['.pdf'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    
    if (!allowedTypes.includes(fileExtension)) {
        setTempMessage('Invalid file type. Please upload a PDF document.', 'error');
        return;
    }

    // Check file size - Max 5MB
    const maxSizeInBytes = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSizeInBytes) {
        setTempMessage('File is too large. Maximum size is 5MB.', 'error');
        return;
    }

    try {
        uploadingResume = true;
        
        // Generate unique file path with user ID
        const timestamp = new Date().getTime();
        const filePath = `resumes/${currentUser.id}_${timestamp}${fileExtension}`;
        
        // Upload file to Supabase Storage
        const { error: uploadError } = await supabase
            .storage
            .from('profiles')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) throw uploadError;

        // Get public URL for the file
        const { data: publicUrl } = supabase
            .storage
            .from('profiles')
            .getPublicUrl(filePath);

        if (!publicUrl) throw new Error("Could not generate public URL");

        // Update profile with new resume URL
        const { error: updateError } = await supabase
            .from('profiles')
            .update({ 
                resume_url: publicUrl.publicUrl,
                resume_filename: file.name,
                updated_at: new Date().toISOString()
            })
            .eq('user_id', currentUser.id);

        if (updateError) throw updateError;

        // Update local state
        resumeUrl = publicUrl.publicUrl;
        resumeFilename = file.name;

        // Refresh user profile in store
        await userStore.refreshProfile();
        
        setTempMessage('Resume uploaded successfully!', 'success');
        
        // Announce success for screen readers
        document.getElementById('upload-status')?.setAttribute('aria-label', 'Resume uploaded successfully!');

    } catch (error: any) {
        console.error('Resume upload error:', error);
        setTempMessage(`Error uploading resume: ${error.message || 'Unknown error'}`, 'error');
    } finally {
        uploadingResume = false;
    }
  }

  async function handleProfileUpdate() {
    if (!get(userStore).user) {
      setTempMessage('You must be logged in to update your profile.', 'error');
      return;
    }
    
    // Form validation
    if (!fullName.trim()) {
      setTempMessage('Full name is required.', 'error');
      fullNameInput.focus();
      return;
    }
    
    try {
      loading = true;
      
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          headline: headline.trim(),
          bio: bio.trim(),
          location: location.trim(),
          linkedin_url: linkedinUrl.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', get(userStore).user.id);
        
      if (error) throw error;
      
      // Refresh the profile in store
      await userStore.refreshProfile();
      
      // Success message and switch to view mode
      setTempMessage('Profile updated successfully!', 'success');
      editMode = false;
      
    } catch (error: any) {
      console.error('Profile update error:', error);
      setTempMessage(`Error updating profile: ${error.message || 'Unknown error'}`, 'error');
    } finally {
      loading = false;
    }
  }
  
  // Keyboard handler for cancel button
  function handleKeyDown(event: KeyboardEvent) {
    // If Escape key pressed while in edit mode, cancel edit
    if (event.key === 'Escape' && editMode) {
      cancelEdit();
    }
  }
  
  // Function to cancel edit and restore original values
  function cancelEdit() {
    // Restore original values from store
    initializeFormData(get(userStore).profile);
    editMode = false;
    message = '';
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<svelte:head>
  <title>Job Seeker Profile - HiringHub</title>
  <meta name="description" content="Manage your job seeker profile on HiringHub">
</svelte:head>

<div class="profile-container" role="main" aria-labelledby="profile-title">
  {#if loading || creatingNewProfile}
    <div class="loading-container" aria-live="polite" role="status">
      <p class="loading-text">
        {#if creatingNewProfile}
          Setting up your profile...
        {:else}
          Loading your profile...
        {/if}
      </p>
    </div>
  {:else if !isCorrectProfileType && profileLoadAttempted}
    <div class="error-container" role="alert">
      <h1>Profile Not Available</h1>
      <p>This profile view is only for job seekers. Please use the appropriate profile page for your account type.</p>
    </div>
  {:else if profileIsDefinitelyNull && profileLoadAttempted}
    <div class="error-container" role="alert">
      <h1>Profile Not Found</h1>
      <p>There was an error loading your profile. Please try refreshing the page.</p>
    </div>
  {:else}
    <div class="profile-header">
      <h1 id="profile-title">
        {#if isNewUser}
          Welcome to HiringHub!
        {:else}
          Job Seeker Profile
        {/if}
      </h1>
      
      {#if !editMode}
        <button 
          class="edit-button"
          on:click={toggleEditMode}
          aria-label="Edit profile"
        >
          Edit Profile
        </button>
      {/if}
    </div>
    
    {#if message}
      <div 
        class="message {messageType}-message" 
        role="status" 
        aria-live="polite"
      >
        <p>{message}</p>
      </div>
    {/if}
    
    <div class="profile-content">
      {#if editMode}
        <!-- Edit mode - Form -->
        <form 
          on:submit|preventDefault={handleProfileUpdate}
          class="profile-form"
          aria-labelledby="form-title"
          novalidate
        >
          <h2 id="form-title" class="sr-only">Edit Profile</h2>
          
          <div class="form-group">
            <label for="fullName" id="fullName-label">Full Name <span class="required">*</span></label>
            <input 
              type="text" 
              id="fullName" 
              bind:this={fullNameInput}
              bind:value={fullName} 
              placeholder="Your full name"
              required
              aria-required="true"
            />
          </div>
          
          <div class="form-group">
            <label for="headline" id="headline-label">Professional Headline</label>
            <input 
              type="text" 
              id="headline" 
              bind:value={headline} 
              placeholder="e.g. Senior Software Engineer with 5+ years experience"
              aria-describedby="headline-help"
            />
            <p id="headline-help" class="help-text">A brief professional statement that appears with your name</p>
          </div>
          
          <div class="form-group">
            <label for="bio" id="bio-label">Bio</label>
            <textarea 
              id="bio" 
              bind:value={bio} 
              rows="4" 
              placeholder="Tell employers about yourself, your skills, and your experience"
              aria-describedby="bio-help"
            ></textarea>
            <p id="bio-help" class="help-text">Describe your professional background, key skills, and career goals</p>
          </div>
          
          <div class="form-group">
            <label for="location" id="location-label">Location</label>
            <input 
              type="text" 
              id="location" 
              bind:value={location} 
              placeholder="e.g. New York, NY"
              aria-describedby="location-help"
            />
            <p id="location-help" class="help-text">City and state/province, or country</p>
          </div>
          
          <div class="form-group">
            <label for="linkedinUrl" id="linkedinUrl-label">LinkedIn Profile</label>
            <input 
              type="url" 
              id="linkedinUrl" 
              bind:value={linkedinUrl} 
              placeholder="https://www.linkedin.com/in/yourprofile"
              aria-describedby="linkedin-help"
            />
            <p id="linkedin-help" class="help-text">URL to your LinkedIn profile (optional)</p>
          </div>
          
          <div class="form-actions">
            <button 
              type="submit" 
              class="save-button"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? 'Saving...' : 'Save Profile'}
            </button>
            
            <button 
              type="button" 
              class="cancel-button"
              on:click={cancelEdit}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      {:else}
        <!-- View mode -->
        <div class="profile-view" aria-labelledby="profile-information">
          <h2 id="profile-information" class="sr-only">Profile Information</h2>
          
          <div class="profile-section">
            <h3>Personal Information</h3>
            
            <div class="profile-field">
              <span class="field-label">Name:</span>
              <span class="field-value">{fullName || 'Not provided'}</span>
            </div>
            
            {#if headline}
              <div class="profile-field">
                <span class="field-label">Headline:</span>
                <span class="field-value">{headline}</span>
              </div>
            {/if}
            
            {#if location}
              <div class="profile-field">
                <span class="field-label">Location:</span>
                <span class="field-value">{location}</span>
              </div>
            {/if}
            
            {#if linkedinUrl}
              <div class="profile-field">
                <span class="field-label">LinkedIn:</span>
                <a 
                  href={linkedinUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  class="linkedin-link"
                  aria-label="View LinkedIn profile (opens in a new tab)"
                >
                  {linkedinUrl}
                </a>
              </div>
            {/if}
          </div>
          
          {#if bio}
            <div class="profile-section">
              <h3>Bio</h3>
              <p class="bio-text">{bio}</p>
            </div>
          {/if}
        </div>
      {/if}
      
      <!-- Resume section - Always visible -->
      <div class="resume-section" aria-labelledby="resume-section-title">
        <h3 id="resume-section-title">Resume</h3>
        
        <div class="resume-upload-container">
          {#if resumeUrl}
            <div class="current-resume">
              <p>Current resume: 
                <a 
                  href={resumeUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  aria-label="View current resume (opens in a new tab)"
                >
                  {resumeFilename || 'View Resume'}
                </a>
              </p>
            </div>
          {:else}
            <p class="no-resume">No resume uploaded yet</p>
          {/if}
          
          <div class="upload-container">
            <label for="resume-upload" class="upload-label">
              Update Resume (PDF only)
            </label>
            <input 
              type="file" 
              id="resume-upload" 
              accept=".pdf" 
              on:change={handleResumeUpload}
              aria-describedby="resume-help upload-status"
              disabled={uploadingResume}
            />
            <p id="resume-help" class="help-text">Upload a PDF file, max 5MB</p>
            <p id="upload-status" class="sr-only" aria-live="polite"></p>
          </div>
          
          {#if uploadingResume}
            <div class="upload-status" role="status" aria-live="polite">
              <p>Uploading resume...</p>
            </div>
          {/if}
        </div>
      </div>
    </div>
  {/if}
</div>

<style>
  /* Screen reader only class */
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }

  .profile-container {
    max-width: 800px;
    margin: 0 auto;
    padding: var(--spacing-lg);
  }
  
  .profile-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-lg);
  }
  
  .profile-header h1 {
    margin: 0;
    color: var(--heading-color);
  }
  
  .edit-button {
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--border-radius);
    padding: 0.5rem 1rem;
    font-size: 1rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .edit-button:hover, .edit-button:focus {
    background-color: var(--primary-color-dark);
  }
  
  .edit-button:focus {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
  }
  
  .profile-content {
    background-color: var(--surface-color);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
    padding: var(--spacing-lg);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }
  
  /* Form styles */
  .profile-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }
  
  .form-group {
    margin-bottom: var(--spacing-md);
  }
  
  .form-group label {
    display: block;
    margin-bottom: var(--spacing-xs);
    font-weight: 500;
  }
  
  .required {
    color: var(--error-text-color);
  }
  
  input, textarea {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    font-size: 1rem;
    font-family: inherit;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  
  input:focus, textarea:focus {
    border-color: var(--primary-color);
    outline: none;
    box-shadow: 0 0 0 2px var(--focus-ring-color);
  }
  
  textarea {
    resize: vertical;
    min-height: 120px;
  }
  
  .help-text {
    font-size: 0.875rem;
    color: var(--text-color-secondary);
    margin-top: 0.25rem;
  }
  
  .form-actions {
    display: flex;
    gap: var(--spacing-md);
    margin-top: var(--spacing-lg);
  }
  
  .save-button, .cancel-button {
    padding: 0.75rem 1.5rem;
    border-radius: var(--border-radius);
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.2s;
    min-width: 120px;
  }
  
  .save-button {
    background-color: var(--primary-color);
    color: white;
    border: none;
  }
  
  .save-button:hover:not(:disabled), .save-button:focus:not(:disabled) {
    background-color: var(--primary-color-dark);
  }
  
  .save-button:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  .cancel-button {
    background-color: var(--surface-color);
    color: var(--text-color);
    border: 1px solid var(--border-color);
  }
  
  .cancel-button:hover, .cancel-button:focus {
    background-color: var(--hover-color);
  }
  
  .save-button:focus, .cancel-button:focus {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
  }
  
  /* Profile view styles */
  .profile-view {
    margin-bottom: var(--spacing-lg);
  }
  
  .profile-section {
    margin-bottom: var(--spacing-lg);
  }
  
  .profile-section h3 {
    margin-top: 0;
    margin-bottom: var(--spacing-md);
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--border-color);
    color: var(--heading-color);
  }
  
  .profile-field {
    margin-bottom: var(--spacing-sm);
    display: flex;
    flex-wrap: wrap;
  }
  
  .field-label {
    font-weight: 500;
    margin-right: var(--spacing-sm);
    min-width: 100px;
  }
  
  .field-value {
    color: var(--text-color);
    flex: 1;
  }
  
  .bio-text {
    white-space: pre-line;
    line-height: 1.6;
  }
  
  .linkedin-link {
    color: var(--primary-color);
    text-decoration: none;
    word-break: break-all;
  }
  
  .linkedin-link:hover, .linkedin-link:focus {
    text-decoration: underline;
  }
  
  .linkedin-link:focus {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
  }
  
  /* Resume section */
  .resume-section {
    margin-top: var(--spacing-lg);
    padding-top: var(--spacing-lg);
    border-top: 1px solid var(--border-color);
  }
  
  .resume-section h3 {
    margin-top: 0;
    margin-bottom: var(--spacing-md);
  }
  
  .resume-upload-container {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }
  
  .current-resume {
    padding: var(--spacing-md);
    background-color: var(--surface-secondary-color, #f8fafc);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
  }
  
  .current-resume a {
    color: var(--primary-color);
    text-decoration: none;
    font-weight: 500;
  }
  
  .current-resume a:hover, .current-resume a:focus {
    text-decoration: underline;
  }
  
  .current-resume a:focus {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
  }
  
  .no-resume {
    color: var(--text-color-secondary);
    font-style: italic;
  }
  
  .upload-container {
    margin-top: var(--spacing-sm);
  }
  
  .upload-label {
    display: inline-block;
    background-color: var(--primary-color);
    color: white;
    padding: 0.5rem 1rem;
    border-radius: var(--border-radius);
    cursor: pointer;
    margin-bottom: var(--spacing-sm);
    transition: background-color 0.2s;
  }
  
  .upload-label:hover, .upload-label:focus-within {
    background-color: var(--primary-color-dark);
  }
  
  input[type="file"] {
    width: 0.1px;
    height: 0.1px;
    opacity: 0;
    overflow: hidden;
    position: absolute;
    z-index: -1;
  }
  
  input[type="file"]:focus + label {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
  }
  
  .upload-status {
    margin-top: var(--spacing-sm);
    color: var(--primary-color);
    font-style: italic;
  }
  
  /* Loading and error containers */
  .loading-container, .error-container {
    padding: var(--spacing-lg);
    border-radius: var(--border-radius);
    text-align: center;
  }
  
  .loading-container {
    background-color: var(--surface-color);
    border: 1px solid var(--border-color);
    margin-bottom: var(--spacing-lg);
  }
  
  .loading-text {
    color: var(--text-color-secondary);
    font-style: italic;
  }
  
  .error-container {
    background-color: var(--error-bg-color, #fee2e2);
    border: 1px solid var(--error-text-color, #b91c1c);
  }
  
  .error-container h1 {
    color: var(--error-text-color, #b91c1c);
    margin-top: 0;
  }
  
  /* Message styling */
  .message {
    padding: var(--spacing-md);
    border-radius: var(--border-radius);
    margin-bottom: var(--spacing-lg);
    font-weight: 500;
  }
  
  .message p {
    margin: 0;
  }
  
  .error-message {
    background-color: var(--error-bg-color, #fee2e2);
    color: var(--error-text-color, #b91c1c);
    border-left: 4px solid var(--error-text-color, #b91c1c);
  }
  
  .success-message {
    background-color: var(--success-bg-color, #dcfce7);
    color: var(--success-text-color, #166534);
    border-left: 4px solid var(--success-text-color, #166534);
  }
  
  .info-message {
    background-color: var(--info-bg-color, #e0f2fe);
    color: var(--info-text-color, #0369a1);
    border-left: 4px solid var(--info-text-color, #0369a1);
  }
  
  /* Media queries for responsive design */
  @media (max-width: 768px) {
    .profile-header {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--spacing-md);
    }
    
    .edit-button {
      align-self: flex-start;
    }
    
    .form-actions {
      flex-direction: column;
    }
    
    .save-button, .cancel-button {
      width: 100%;
    }
    
    .profile-field {
      flex-direction: column;
    }
    
    .field-label {
      margin-bottom: 0.25rem;
    }
  }
  
  /* Reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .edit-button,
    .save-button,
    .cancel-button,
    .upload-label,
    input,
    textarea {
      transition: none;
    }
  }
</style> 