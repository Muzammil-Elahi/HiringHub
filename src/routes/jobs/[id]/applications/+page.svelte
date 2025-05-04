<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';
  import userStore from '$lib/stores/userStore';
  import { calculateMatchPercentage, extractResumeText } from '$lib/utils/matchingAlgorithm';

  export let data;
  let job = data.job || {};
  
  // Applications state
  let applications: any[] = [];
  let sortedApplications: any[] = [];
  let loading = true;
  let error = '';
  
  // Sorting options
  let sortOption = 'date'; // Default sort by application date
  let sortOrder = 'desc'; // Default descending order (newest first)
  
  // Match calculation state
  let calculatingMatches = false;
  let matchesCalculated = false;

  // Fetch applications for this job
  async function fetchApplications() {
    if (!$userStore.loggedIn || !$userStore.user) {
      error = 'You must be logged in to view applications.';
      loading = false;
      return;
    }

    if ($userStore.profile?.account_type !== 'hiring_manager') {
      error = 'Only hiring managers can view applications.';
      loading = false;
      return;
    }

    try {
      // Use Supabase's relationship query
      const { data: applicationData, error: fetchError } = await supabase
        .from('applications')
        .select(`
          *,
          profiles:job_seeker_id (
            user_id,
            full_name,
            headline,
            location,
            avatar_url,
            resume_url
          )
        `)
        .eq('job_id', job.id)
        .order('application_date', { ascending: false });

      if (fetchError) throw fetchError;
      
      applications = applicationData || [];
      sortedApplications = [...applications];
      
      // Begin calculating match percentages
      if (applications.length > 0) {
        calculateMatchPercentages();
      }
    } catch (err: any) {
      console.error('Error fetching applications:', err);
      error = `Failed to load applications: ${err.message}`;
    } finally {
      loading = false;
    }
  }
  
  // Calculate match percentages for all applications
  async function calculateMatchPercentages() {
    calculatingMatches = true;
    
    try {
      for (const application of applications) {
        const resumeUrl = application.resume_snapshot_url || application.profiles?.resume_url;
        
        if (resumeUrl) {
          try {
            // Extract text from the resume
            const resumeText = await extractResumeText(resumeUrl);
            
            if (resumeText) {
              // Calculate match percentage
              const matchScore = calculateMatchPercentage(resumeText, job);
              
              // Add match score to the application object
              application.matchPercentage = matchScore;
            } else {
              application.matchPercentage = 0;
              application.matchError = "Couldn't extract resume text";
            }
          } catch (err) {
            console.error("Error calculating match for applicant:", application.profiles?.full_name, err);
            application.matchPercentage = 0;
            application.matchError = "Error calculating match";
          }
        } else {
          application.matchPercentage = 0;
          application.matchError = "No resume available";
        }
      }
      
      matchesCalculated = true;
      applySort(); // Re-sort after calculating matches
      
    } catch (err) {
      console.error("Error in match calculation process:", err);
    } finally {
      calculatingMatches = false;
    }
  }
  
  // Apply sorting to applications
  function applySort() {
    sortedApplications = [...applications].sort((a, b) => {
      if (sortOption === 'match') {
        // Sort by match percentage
        const matchA = a.matchPercentage || 0;
        const matchB = b.matchPercentage || 0;
        return sortOrder === 'desc' ? matchB - matchA : matchA - matchB;
      } else if (sortOption === 'name') {
        // Sort by applicant name
        const nameA = a.profiles?.full_name || '';
        const nameB = b.profiles?.full_name || '';
        return sortOrder === 'desc' 
          ? nameB.localeCompare(nameA) 
          : nameA.localeCompare(nameB);
      } else if (sortOption === 'status') {
        // Sort by application status
        const statusA = a.status || '';
        const statusB = b.status || '';
        return sortOrder === 'desc' 
          ? statusB.localeCompare(statusA) 
          : statusA.localeCompare(statusB);
      } else {
        // Default sort by date
        const dateA = new Date(a.application_date).getTime();
        const dateB = new Date(b.application_date).getTime();
        return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
      }
    });
  }
  
  // Handle sort option change
  function handleSortChange(option: string) {
    if (sortOption === option) {
      // Toggle sort order if clicking the same option
      sortOrder = sortOrder === 'desc' ? 'asc' : 'desc';
    } else {
      // Set new sort option with default desc order
      sortOption = option;
      sortOrder = 'desc';
    }
    applySort();
  }

  // Handle application status update
  async function updateApplicationStatus(applicationId: string, newStatus: string) {
    try {
      const { error: updateError } = await supabase
        .from('applications')
        .update({ status: newStatus })
        .eq('id', applicationId)
        .eq('job_id', job.id); // Ensure it's for the current job

      if (updateError) throw updateError;

      // Update local state
      applications = applications.map(app => 
        app.id === applicationId ? { ...app, status: newStatus } : app
      );
      
      // Update sorted applications too
      sortedApplications = sortedApplications.map(app => 
        app.id === applicationId ? { ...app, status: newStatus } : app
      );

    } catch (err: any) {
      console.error('Error updating application status:', err);
      alert(`Failed to update application status: ${err.message}`);
    }
  }

  // Format date helper
  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  // Get status color class
  function getStatusClass(status: string): string {
    if (!status) return '';
    
    const statusLower = status.toLowerCase();
    
    if (statusLower.includes('submit') || statusLower === 'pending') {
      return 'status-submitted';
    } else if (statusLower.includes('review')) {
      return 'status-reviewed';
    } else if (statusLower.includes('interview')) {
      return 'status-interview';
    } else if (statusLower.includes('reject')) {
      return 'status-rejected';
    } else if (statusLower.includes('accept')) {
      return 'status-accepted';
    }
    
    return '';
  }
  
  // Get match score color class
  function getMatchClass(score: number): string {
    if (score >= 70) {
      return 'match-high';
    } else if (score >= 40) {
      return 'match-medium';
    } else {
      return 'match-low';
    }
  }

  // View applicant profile
  function viewApplicantProfile(userId: string) {
    goto(`/profile/job-seeker/${userId}`);
  }

  onMount(fetchApplications);
</script>

<div class="container applications-page">
  <div class="page-header">
    <div>
      <h2>Applications for: {job.title || 'Loading...'}</h2>
      <p class="company">{job.company_name || ''}</p>
    </div>
    <a href="/jobs/{job.id}" class="btn-secondary">Back to Job</a>
  </div>

  {#if !$userStore.loggedIn}
    <p>Please <a href="/login">log in</a> to view applications.</p>
  {:else if $userStore.profile?.account_type !== 'hiring_manager'}
    <p class="message error">Only hiring managers can view applications.</p>
  {:else if loading}
    <p>Loading applications...</p>
  {:else if error}
    <p class="message error">{error}</p>
  {:else if applications.length === 0}
    <div class="empty-state">
      <p>No applications have been submitted for this job yet.</p>
    </div>
  {:else}
    <div class="application-stats">
      <div class="stats-info">
        <p>Total applications: <strong>{applications.length}</strong></p>
        
        {#if calculatingMatches}
          <p class="calculating-note">Calculating match scores...</p>
        {/if}
      </div>
      
      <div class="sort-controls">
        <span class="sort-label">Sort by:</span>
        <div class="sort-buttons">
          <button 
            class="sort-btn {sortOption === 'date' ? 'active' : ''}"
            on:click={() => handleSortChange('date')}
          >
            Date {sortOption === 'date' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
          </button>
          <button 
            class="sort-btn {sortOption === 'match' ? 'active' : ''}"
            on:click={() => handleSortChange('match')}
            disabled={!matchesCalculated}
          >
            Match % {sortOption === 'match' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
          </button>
          <button 
            class="sort-btn {sortOption === 'name' ? 'active' : ''}"
            on:click={() => handleSortChange('name')}
          >
            Name {sortOption === 'name' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
          </button>
          <button 
            class="sort-btn {sortOption === 'status' ? 'active' : ''}"
            on:click={() => handleSortChange('status')}
          >
            Status {sortOption === 'status' ? (sortOrder === 'desc' ? '↓' : '↑') : ''}
          </button>
        </div>
      </div>
    </div>
    
    <div class="applications-list">
      {#each sortedApplications as application}
        <div class="application-card">
          <div class="application-header">
            <div class="applicant-info">
              {#if application.profiles?.avatar_url}
                <img src={application.profiles.avatar_url} alt="Profile" class="avatar" />
              {:else}
                <div class="avatar-placeholder">{(application.profiles?.full_name || 'User').charAt(0)}</div>
              {/if}
              <div>
                <h3>{application.profiles?.full_name || 'Applicant'}</h3>
                {#if application.profiles?.headline}
                  <p class="headline">{application.profiles.headline}</p>
                {/if}
                {#if application.profiles?.location}
                  <p class="location">{application.profiles.location}</p>
                {/if}
              </div>
            </div>
            <div class="application-meta">
              <span class="application-date">Applied on {formatDate(application.application_date)}</span>
              <span class={`application-status ${getStatusClass(application.status)}`}>
                {application.status}
              </span>
              
              <!-- Match percentage display -->
              {#if application.matchPercentage !== undefined}
                <div class={`match-percentage ${getMatchClass(application.matchPercentage)}`}>
                  <div class="match-value">{application.matchPercentage}%</div>
                  <div class="match-label">match</div>
                </div>
              {:else if application.matchError}
                <div class="match-error">{application.matchError}</div>
              {:else if calculatingMatches}
                <div class="match-calculating">Calculating...</div>
              {/if}
            </div>
          </div>
          
          {#if application.cover_letter}
            <div class="cover-letter">
              <h4>Cover Letter</h4>
              <p>{application.cover_letter}</p>
            </div>
          {/if}
          
          <div class="application-actions">
            <div class="status-update">
              <label for="status-{application.id}">Update Status:</label>
              <select 
                id="status-{application.id}" 
                value={application.status}
                on:change={(e) => updateApplicationStatus(application.id, (e.target as HTMLSelectElement).value)}
              >
                <option value="Submitted">Submitted</option>
                <option value="Reviewed">Reviewed</option>
                <option value="Interview">Interview</option>
                <option value="Rejected">Rejected</option>
                <option value="Accepted">Accepted</option>
              </select>
            </div>
            
            <div class="action-buttons">
              {#if application.profiles?.resume_url}
                <a href={application.profiles.resume_url} target="_blank" class="btn-secondary">View Resume</a>
              {:else if application.resume_snapshot_url}
                <a href={application.resume_snapshot_url} target="_blank" class="btn-secondary">View Resume</a>
              {/if}
              <button 
                class="btn-primary" 
                on:click={() => viewApplicantProfile(application.profiles.user_id)}
              >
                View Profile
              </button>
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .applications-page {
    max-width: 900px;
    margin: var(--spacing-lg) auto;
  }
  
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--spacing-lg);
  }
  
  .company {
    color: var(--text-muted-color);
    margin-top: 0;
  }
  
  .empty-state {
    text-align: center;
    padding: var(--spacing-xl);
    background-color: var(--surface-secondary-color, #f3f4f6);
    border-radius: var(--border-radius);
    margin-top: var(--spacing-lg);
  }
  
  .application-stats {
    margin-bottom: var(--spacing-md);
    padding: var(--spacing-sm) var(--spacing-md);
    background-color: var(--surface-secondary-color, #f3f4f6);
    border-radius: var(--border-radius);
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--spacing-md);
  }
  
  .calculating-note {
    font-size: 0.875rem;
    color: var(--primary-color);
    font-style: italic;
    margin: 0;
  }
  
  .sort-controls {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }
  
  .sort-label {
    font-size: 0.875rem;
    color: var(--text-muted-color);
  }
  
  .sort-buttons {
    display: flex;
    gap: var(--spacing-xs);
  }
  
  .sort-btn {
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: 0.75rem;
    background-color: var(--background-color, white);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    cursor: pointer;
    color: var(--text-color);
  }
  
  .sort-btn:hover:not(:disabled) {
    background-color: var(--background-hover-color, #f9fafb);
    border-color: var(--primary-color);
  }
  
  .sort-btn.active {
    background-color: var(--primary-color);
    color: var(--primary-contrast-color);
    border-color: var(--primary-color);
  }
  
  .sort-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
  
  .applications-list {
    display: grid;
    gap: var(--spacing-md);
  }
  
  .application-card {
    background-color: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-md);
    transition: box-shadow 0.2s;
  }
  
  .application-card:hover {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }
  
  .application-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: var(--spacing-md);
    flex-wrap: wrap;
    gap: var(--spacing-sm);
  }
  
  .applicant-info {
    display: flex;
    align-items: center;
    gap: var(--spacing-md);
  }
  
  .avatar, .avatar-placeholder {
    width: 50px;
    height: 50px;
    border-radius: 50%;
    overflow: hidden;
  }
  
  .avatar-placeholder {
    background-color: var(--primary-color);
    color: var(--primary-contrast-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1.5rem;
    font-weight: bold;
  }
  
  .application-meta {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: var(--spacing-xs);
  }
  
  .application-date {
    font-size: 0.875rem;
    color: var(--text-muted-color);
  }
  
  .application-status {
    font-size: 0.875rem;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-weight: 500;
  }
  
  /* Match percentage styles */
  .match-percentage {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    border-radius: var(--border-radius);
    padding: 0.25rem 0.5rem;
    margin-top: var(--spacing-xs);
    font-weight: 600;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
    min-width: 60px;
  }
  
  .match-value {
    font-size: 1rem;
    line-height: 1;
  }
  
  .match-label {
    font-size: 0.7rem;
    text-transform: uppercase;
    opacity: 0.8;
  }
  
  .match-high {
    background-color: #10b981; /* Green */
    color: white;
  }
  
  .match-medium {
    background-color: #f59e0b; /* Amber */
    color: white;
  }
  
  .match-low {
    background-color: #ef4444; /* Red */
    color: white;
  }
  
  .match-error, .match-calculating {
    font-size: 0.75rem;
    margin-top: var(--spacing-xs);
    padding: 0.25rem 0.5rem;
    border-radius: var(--border-radius);
  }
  
  .match-error {
    color: var(--error-text-color);
    background-color: var(--error-bg-color);
  }
  
  .match-calculating {
    color: var(--text-muted-color);
    background-color: var(--surface-secondary-color);
    font-style: italic;
  }
  
  .status-submitted {
    background-color: var(--info-bg-color, #e0f2fe);
    color: var(--info-text-color, #0369a1);
  }
  
  .status-reviewed {
    background-color: var(--warning-bg-color, #fff7ed);
    color: var(--warning-text-color, #c2410c);
  }
  
  .status-interview {
    background-color: var(--primary-bg-color, #dbeafe);
    color: var(--primary-color, #2563eb);
  }
  
  .status-rejected {
    background-color: var(--error-bg-color, #fee2e2);
    color: var(--error-text-color, #b91c1c);
  }
  
  .status-accepted {
    background-color: var(--success-bg-color, #dcfce7);
    color: var(--success-text-color, #166534);
  }
  
  .headline {
    margin: 0.25rem 0;
    font-size: 0.875rem;
  }
  
  .location {
    margin: 0.25rem 0;
    font-size: 0.875rem;
    color: var(--text-muted-color);
  }
  
  .cover-letter {
    margin-bottom: var(--spacing-md);
    padding: var(--spacing-md);
    background-color: var(--surface-secondary-color, #f3f4f6);
    border-radius: var(--border-radius);
  }
  
  .cover-letter h4 {
    margin-top: 0;
    margin-bottom: var(--spacing-xs);
    font-size: 1rem;
  }
  
  .cover-letter p {
    margin: 0;
    white-space: pre-line;
  }
  
  .application-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: var(--spacing-md);
    flex-wrap: wrap;
    gap: var(--spacing-md);
  }
  
  .status-update {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
  }
  
  .status-update select {
    padding: var(--spacing-xs) var(--spacing-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background-color: var(--background-color, white);
  }
  
  .action-buttons {
    display: flex;
    gap: var(--spacing-sm);
    flex-wrap: wrap;
  }
  
  .btn-primary {
    padding: var(--spacing-sm) var(--spacing-md);
    background-color: var(--primary-color);
    color: var(--primary-contrast-color);
    border: none;
    border-radius: var(--border-radius);
    cursor: pointer;
    font-size: var(--font-size-base);
    font-weight: 500;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    transition: background-color 0.2s ease;
  }
  
  .btn-primary:hover {
    background-color: var(--primary-color-dark);
  }
  
  .btn-secondary {
    padding: var(--spacing-sm) var(--spacing-md);
    background-color: var(--background-color, white);
    color: var(--primary-color);
    border: 1px solid var(--primary-color);
    border-radius: var(--border-radius);
    cursor: pointer;
    font-size: var(--font-size-base);
    font-weight: 500;
    text-decoration: none;
    display: inline-flex;
    align-items: center;
    transition: background-color 0.2s ease, border-color 0.2s ease;
  }
  
  .btn-secondary:hover {
    background-color: var(--background-hover-color, #f9fafb);
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
  
  @media (max-width: 768px) {
    .application-stats {
      flex-direction: column;
      align-items: flex-start;
    }
    
    .sort-controls {
      flex-direction: column;
      align-items: flex-start;
      width: 100%;
    }
    
    .sort-buttons {
      width: 100%;
      overflow-x: auto;
      padding-bottom: var(--spacing-xs);
    }
    
    .application-header,
    .application-actions {
      flex-direction: column;
      align-items: flex-start;
    }
    
    .application-meta {
      align-items: flex-start;
      margin-top: var(--spacing-sm);
    }
    
    .action-buttons {
      margin-top: var(--spacing-sm);
      width: 100%;
    }
    
    .status-update {
      width: 100%;
    }
  }
</style> 