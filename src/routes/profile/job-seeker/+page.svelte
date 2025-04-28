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
    };
  });

  async function handleResumeUpload(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];

    if (!file) {
        message = 'No file selected.';
        messageType = 'error';
        return;
    }

    const currentUser = get(userStore).user;
    if (!currentUser) {
        message = 'You must be logged in to upload a resume.';
        messageType = 'error';
        return;
    }

    // Basic file type check - ONLY PDF
    const allowedTypes = ['.pdf'];
    const fileExtension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (!allowedTypes.includes(fileExtension)) {
        message = `Invalid file type. Only PDF files are allowed.`;
        messageType = 'error';
        return;
    }

    // Max file size check (e.g., 5MB)
    const maxSizeMB = 5;
    if (file.size > maxSizeMB * 1024 * 1024) {
        message = `File size exceeds the ${maxSizeMB}MB limit.`;
        messageType = 'error';
        return;
    }

    uploadingResume = true;
    message = ''; // Clear previous messages
    messageType = 'success'; // Assume success unless error occurs

    try {
        // Save original filename (without path) for display purposes
        resumeFilename = file.name;
        
        // Create a sanitized filename for storage
        const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9-_.]/g, '_');

        // Upload to Supabase Storage (bucket named 'resumes')
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('resumes')
            .upload(sanitizedFilename, file, { 
              upsert: true,
              cacheControl: '3600' 
            });

        if (uploadError) {
            console.error('Supabase upload error:', uploadError);
            
            // Check if error is related to permissions
            if (uploadError.message?.includes('permission') || uploadError.message?.includes('Unauthorized')) {
                throw new Error(`Permission denied: ${uploadError.message}. Check Supabase storage bucket permissions.`);
            }
            
            throw new Error(`Failed to upload resume: ${uploadError.message}`);
        }

        console.log('Upload successful:', uploadData);

        // Get the public URL for the uploaded file
        const { data: urlData } = supabase.storage
            .from('resumes')
            .getPublicUrl(sanitizedFilename);

        console.log('URL data:', urlData);

        if (!urlData || !urlData.publicUrl) {
             console.error('Supabase getPublicUrl error: No URL returned for', sanitizedFilename);
            throw new Error('Could not get public URL for the uploaded resume.');
        }

        // Test if the URL is accessible
        console.log('Testing URL accessibility...');
        try {
            const testResponse = await fetch(urlData.publicUrl, { method: 'HEAD' });
            console.log('URL test result:', testResponse.status, testResponse.statusText);
            
            if (!testResponse.ok) {
                console.warn('URL may not be publicly accessible:', testResponse.status);
            }
        } catch (fetchError) {
            console.warn('Could not verify URL accessibility:', fetchError);
            // Continue anyway as this is just a test
        }

        // Update the local state immediately
        resumeUrl = urlData.publicUrl;
        console.log('Resume URL set to:', resumeUrl);
        
        message = 'Resume uploaded successfully! Remember to save your profile to persist the link.';
        messageType = 'success';

        // Clear the file input visually
        target.value = '';

    } catch (error: any) {
        console.error('Resume upload process error:', error);
        message = `Resume upload failed: ${error.message}`;
        messageType = 'error';
    } finally {
        uploadingResume = false;
    }
  }

  async function handleProfileUpdate() {
    const currentUser = get(userStore).user;
    if (!currentUser) {
        message = 'You must be logged in to update your profile.';
        messageType = 'error';
        return;
    }

    // Optional: Basic LinkedIn URL validation
    if (linkedinUrl && !linkedinUrl.startsWith('https://www.linkedin.com/in/') && !linkedinUrl.startsWith('http://www.linkedin.com/in/')) { // Allow http too
         message = 'Please enter a valid LinkedIn profile URL (e.g., https://www.linkedin.com/in/yourprofile).';
         messageType = 'error';
         return;
    }

    loading = true; // Use general loading for saving
    message = '';
    try {
        console.log('Starting profile update with resume data:', {
          resumeUrl,
          resumeFilename
        });
        
        const updates = {
            full_name: fullName,
            headline: headline,
            bio: bio,
            location: location,
            linkedin_url: linkedinUrl,
            resume_url: resumeUrl, // Use the locally updated resumeUrl
            resume_filename: resumeFilename, // Store the filename too
            updated_at: new Date().toISOString(), // Convert Date to string for compatibility
        };

        console.log('Updating profile with data:', updates);

        const { data: updateData, error } = await supabase
            .from('profiles')
            .update(updates)
            .eq('user_id', currentUser.id)
            .select();

        if (error) throw error;
        
        console.log('Profile update response:', updateData);

        // Update store with the returned data if available, otherwise use our local updates
        if (updateData && updateData.length > 0) {
          userStore.set({
            ...get(userStore),
            profile: updateData[0]
          });
        } else {
          userStore.updateProfile(updates); // Update store locally
        }

        message = isNewUser 
          ? 'Profile created successfully! You can now browse job postings.' 
          : 'Profile updated successfully!';
        isNewUser = false; // Reset new user flag after first save
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

  // Add deleteResume function after handleProfileUpdate
  async function deleteResume() {
    if (!confirm('Are you sure you want to delete your resume? This cannot be undone.')) {
      return;
    }
    
    const currentUser = get(userStore).user;
    if (!currentUser || !resumeUrl) {
      message = 'No resume to delete or you are not logged in.';
      messageType = 'error';
      return;
    }
    
    loading = true;
    message = '';
    
    try {
      // Extract the file path from the URL or use the stored filename
      // For simplicity, we're just deleting by the filename that we stored earlier
      if (resumeFilename) {
        // Delete from storage
        const { error: deleteError } = await supabase.storage
          .from('resumes')
          .remove([resumeFilename]);
          
        if (deleteError) {
          console.error('Error deleting resume:', deleteError);
          throw new Error(`Failed to delete resume: ${deleteError.message}`);
        }
      }
      
      // Update profile to remove resume references
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          resume_url: null,
          resume_filename: null,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', currentUser.id);
        
      if (updateError) throw updateError;
      
      // Update local state
      resumeUrl = '';
      resumeFilename = '';
      
      // Update the user store
      userStore.updateProfile({
        resume_url: null,
        resume_filename: null
      });
      
      message = 'Resume deleted successfully.';
      messageType = 'success';
      
    } catch (error: any) {
      console.error('Error deleting resume:', error);
      message = `Failed to delete resume: ${error.message}`;
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
    <p class="message error">
      {#if profileIsDefinitelyNull}
        Your job seeker profile data could not be loaded. It might not exist yet or there was an error.
        Please try refreshing the page. If the problem persists, contact support.
      {:else if profileLoadAttempted}
        Could not display profile. Your account type might not be 'job_seeker' or the profile data is missing.
        {#if $userStore.profile?.account_type === 'hiring_manager'}
            You are currently logged in as a Hiring Manager. <a href="/profile/hiring-manager">View Hiring Manager Profile</a>.
        {/if}
      {:else}
        There was an issue loading your profile. Please try again later.
      {/if}
    </p>
  {:else}
    {#if message}
      <p class="message {messageType}">{message}</p>
    {/if}

    {#if isNewUser}
      <div class="welcome-box">
        <h3>Welcome to HiringHub!</h3>
        <p>Complete your profile information to help employers find you and match you with job opportunities.</p>
      </div>
    {/if}

    <!-- VIEW MODE -->
    {#if !editMode}
      <div class="profile-view">
        <div class="profile-header">
          <div class="profile-info">
            <h3>{fullName || 'Your Name'}</h3>
            {#if headline}
              <p class="headline">{headline}</p>
            {/if}
            {#if location}
              <p class="location"><i class="location-icon">📍</i> {location}</p>
            {/if}
          </div>
          <button class="btn-secondary edit-profile-btn" on:click={toggleEditMode}>Edit Profile</button>
        </div>

        {#if bio}
          <div class="profile-section">
            <h4>About</h4>
            <p class="bio">{bio}</p>
          </div>
        {/if}

        {#if linkedinUrl}
          <div class="profile-section">
            <h4>Professional Links</h4>
            <p>
              <a href={linkedinUrl} target="_blank" rel="noopener noreferrer">
                <span class="link-icon">🔗</span> LinkedIn Profile
              </a>
            </p>
          </div>
        {/if}

        {#if resumeUrl}
          <div class="profile-section">
            <h4>Resume</h4>
            <div class="resume-preview">
              <div class="resume-actions">
                <a href={resumeUrl} target="_blank" rel="noopener noreferrer" class="resume-link">
                  <span class="link-icon">📄</span> View Resume
                </a>
                <span class="resume-format">PDF Document</span>
              </div>
              <div class="resume-thumbnail">
                <div class="pdf-icon">PDF</div>
                <p class="resume-filename">{resumeFilename || 'Resume'}</p>
                <div class="resume-buttons">
                  <a href={resumeUrl} download="{resumeFilename}" class="download-button">
                    <span class="download-icon">⬇️</span> Download
                  </a>
                  <button type="button" class="delete-button" on:click={deleteResume}>
                    <span class="delete-icon">🗑️</span> Delete
                  </button>
                </div>
              </div>
            </div>
          </div>
        {/if}

        <!-- Empty state for incomplete profiles -->
        {#if !headline && !bio && !location && !linkedinUrl && !resumeUrl}
          <div class="profile-empty">
            <p>Your profile is waiting to be completed. Click "Edit Profile" to add your information.</p>
          </div>
        {/if}
      </div>
    {:else}
      <!-- EDIT MODE -->
    <form on:submit|preventDefault={handleProfileUpdate} class="profile-form">
      <div class="form-group">
          <label for="fullName">Full Name*</label>
          <input id="fullName" type="text" bind:value={fullName} placeholder="Your Name" disabled={loading || uploadingResume} required={isNewUser} />
          {#if isNewUser}<small>This is how your name will appear to employers</small>{/if}
      </div>

      <div class="form-group">
          <label for="headline">Professional Headline</label>
        <input id="headline" type="text" bind:value={headline} placeholder="e.g., Aspiring Software Engineer" disabled={loading || uploadingResume} />
          <small>A brief description of your professional identity</small>
      </div>

       <div class="form-group">
        <label for="bio">Bio / Summary</label>
          <textarea id="bio" bind:value={bio} rows="5" placeholder="Tell us about yourself, your skills, and experience..." disabled={loading || uploadingResume}></textarea>
          <small>Summarize your background, skills, and what you're looking for</small>
      </div>

       <div class="form-group">
        <label for="location">Location</label>
        <input id="location" type="text" bind:value={location} placeholder="City, Country" disabled={loading || uploadingResume} />
          <small>Where you're based or willing to work</small>
      </div>

       <div class="form-group">
        <label for="linkedin">LinkedIn Profile URL</label>
        <input id="linkedin" type="url" bind:value={linkedinUrl} placeholder="https://www.linkedin.com/in/yourprofile" disabled={loading || uploadingResume} />
          <small>Link to your professional profile (optional)</small>
      </div>

       <div class="form-group resume-group">
        <label for="resume">Resume (PDF Only)</label>
        {#if resumeUrl}
            <div class="current-resume">
              <p>Current Resume: <a href={resumeUrl} target="_blank" rel="noopener noreferrer">View/Download</a></p>
              <button type="button" class="btn-text-small delete-link" on:click={deleteResume}>
                Delete Resume
              </button>
            </div>
        {:else}
            <p>No resume uploaded.</p>
        {/if}
        <input id="resume" type="file" on:change={handleResumeUpload} accept=".pdf" disabled={loading || uploadingResume} />
         {#if uploadingResume}
            <p>Uploading resume...</p>
         {/if}
        <small>Upload a new resume (PDF only, max 5MB). Save profile to update link.</small>
        <button type="button" class="btn-text-small" 
                on:click={async () => {
                  message = 'Checking storage access...';
                  messageType = 'info';
                  try {
                    // Just verify the bucket is accessible, don't try to create it
                    const { data: listResult, error: listError } = await supabase.storage
                      .from('resumes')
                      .list(get(userStore).user?.id || '', {
                        limit: 1,
                        sortBy: { column: 'name', order: 'desc' }
                      });
                      
                    if (listError) {
                      console.error('Error checking resumes bucket:', listError);
                      message = `Storage access error: ${listError.message}`;
                      messageType = 'error';
                      return;
                    }
                    
                    message = 'Resume storage is accessible. You can upload your resume.';
                    messageType = 'success';
                  } catch (err: any) {
                    console.error('Storage check failed:', err);
                    message = `Storage check failed: ${err.message}`;
                    messageType = 'error';
                  }
                }}
              >
                Check Storage Access
              </button>
      </div>

        <div class="form-actions">
          <button type="button" class="btn-secondary" on:click={toggleEditMode} disabled={loading || uploadingResume}>
            Cancel
          </button>
      <button type="submit" class="btn-primary" disabled={loading || uploadingResume}>
        {#if loading}Saving...
        {:else if uploadingResume}Waiting for upload...
            {:else if isNewUser}Create Profile
            {:else}Save Changes{/if}
      </button>
        </div>
    </form>
    {/if}
  {/if}
</div>

<style>
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

  .bio {
    white-space: pre-line; /* Preserve line breaks */
    line-height: 1.5;
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

  /* EDIT MODE & EXISTING STYLES */
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
  .form-group textarea {
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

  textarea {
      resize: vertical;
      min-height: 100px;
  }

  .form-group small {
    display: block;
    margin-top: var(--spacing-xs);
    color: var(--text-muted-color);
    font-size: var(--font-size-sm);
  }

  .resume-group small {
      display: block;
      margin-top: var(--spacing-xs);
      color: var(--text-muted-color);
      font-size: var(--font-size-sm);
  }
  
   .resume-group input[type="file"] {
      padding: var(--spacing-xs);
      margin-top: var(--spacing-sm);
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

  .message.info {
      background-color: var(--info-bg-color, #e0f2fe);
      color: var(--info-text-color, #0369a1);
      border-color: var(--info-border-color, #93c5fd);
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
  
  .btn-text-small {
    background: none;
    border: none;
    padding: 0;
    margin-top: var(--spacing-xs);
    font-size: var(--font-size-sm);
    color: var(--primary-color);
    text-decoration: underline;
    cursor: pointer;
    display: block;
  }
  
  .btn-text-small:hover {
    color: var(--primary-color-dark);
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

  /* Enhanced resume styles */
  .resume-preview {
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-md);
    margin-top: var(--spacing-sm);
    background-color: var(--background-color, white);
  }

  .resume-preview h5 {
    margin-top: 0;
    margin-bottom: var(--spacing-sm);
    font-weight: 600;
  }

  .resume-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: var(--spacing-md);
  }

  .resume-link {
    display: inline-flex;
    align-items: center;
    color: var(--primary-color);
  }

  .resume-format {
    font-size: 0.85em;
    color: var(--text-muted-color);
    background-color: var(--surface-secondary-color, #f3f4f6);
    padding: 0.2em 0.6em;
    border-radius: 1em;
  }

  .resume-thumbnail {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: var(--spacing-md);
    background-color: var(--surface-secondary-color, #f3f4f6);
    border-radius: var(--border-radius);
    text-align: center;
  }

  .pdf-icon {
    width: 60px;
    height: 60px;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: #e53935;
    color: white;
    border-radius: 4px;
    font-weight: bold;
    margin-bottom: var(--spacing-sm);
  }

  .resume-filename {
    margin: var(--spacing-xs) 0;
    font-size: 0.9em;
  }

  .download-button {
    display: inline-flex;
    align-items: center;
    background-color: var(--primary-color);
    color: white;
    padding: 0.4em 0.8em;
    border-radius: var(--border-radius);
    text-decoration: none;
    font-size: 0.9em;
    margin-top: var(--spacing-sm);
  }

  .download-button:hover {
    background-color: var(--primary-color-dark);
    text-decoration: none;
  }

  .download-icon {
    margin-right: var(--spacing-xs);
  }

  .delete-button {
    display: inline-flex;
    align-items: center;
    background-color: var(--error-bg-color, #fee2e2);
    color: var(--error-text-color, #b91c1c);
    padding: 0.4em 0.8em;
    border-radius: var(--border-radius);
    border: 1px solid var(--error-border-color, #fca5a5);
    text-decoration: none;
    font-size: 0.9em;
    margin-top: var(--spacing-sm);
    cursor: pointer;
  }

  .delete-button:hover {
    background-color: var(--error-border-color, #fca5a5);
    text-decoration: none;
  }

  .delete-icon {
    margin-right: var(--spacing-xs);
  }

  .resume-buttons {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-xs);
    align-items: center;
  }

  .delete-link {
    color: var(--error-text-color, #b91c1c);
  }

  .delete-link:hover {
    color: var(--error-border-color, #fca5a5);
  }

  .current-resume {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }
</style> 