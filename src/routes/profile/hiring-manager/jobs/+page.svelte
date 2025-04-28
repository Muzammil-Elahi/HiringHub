<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';
  import userStore from '$lib/stores/userStore';

  // Job listings state
  let jobs: any[] = [];
  let loading = true;
  let error = '';

  // Fetch jobs posted by the current hiring manager
  async function fetchJobs() {
    if (!$userStore.loggedIn || !$userStore.user) {
      error = 'You must be logged in to view your posted jobs.';
      loading = false;
      return;
    }

    if ($userStore.profile?.account_type !== 'hiring_manager') {
      error = 'Only hiring managers can view posted jobs.';
      loading = false;
      return;
    }

    try {
      const { data, error: fetchError } = await supabase
        .from('jobs')
        .select('*')
        .eq('hiring_manager_id', $userStore.user.id)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      jobs = data || [];
    } catch (err: any) {
      console.error('Error fetching jobs:', err);
      error = `Failed to load jobs: ${err.message}`;
    } finally {
      loading = false;
    }
  }

  // Toggle job active status
  async function toggleJobStatus(jobId: string, currentStatus: boolean) {
    try {
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', jobId)
        .eq('hiring_manager_id', $userStore.user?.id); // Security check

      if (updateError) throw updateError;

      // Update local state
      jobs = jobs.map(job => 
        job.id === jobId ? { ...job, is_active: !currentStatus } : job
      );

    } catch (err: any) {
      console.error('Error updating job status:', err);
      alert(`Failed to update job status: ${err.message}`);
    }
  }

  // Delete job
  async function deleteJob(jobId: string) {
    if (!confirm('Are you sure you want to delete this job posting? This action cannot be undone.')) {
      return;
    }

    try {
      // First delete related job_skills
      const { error: skillsError } = await supabase
        .from('job_skills')
        .delete()
        .eq('job_id', jobId);

      if (skillsError) {
        console.error('Error deleting job skills:', skillsError);
        // Continue anyway to delete the job
      }

      // Then delete the job
      const { error: jobError } = await supabase
        .from('jobs')
        .delete()
        .eq('id', jobId)
        .eq('hiring_manager_id', $userStore.user?.id); // Security check

      if (jobError) throw jobError;

      // Update local state
      jobs = jobs.filter(job => job.id !== jobId);

    } catch (err: any) {
      console.error('Error deleting job:', err);
      alert(`Failed to delete job: ${err.message}`);
    }
  }

  // Format date
  function formatDate(dateString: string) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }

  onMount(fetchJobs);
</script>

<div class="container jobs-page">
  <div class="page-header">
    <h2>Your Job Postings</h2>
    <a href="/jobs/post" class="btn-primary new-job-btn">+ Post New Job</a>
  </div>

  {#if !$userStore.loggedIn}
    <p>Please <a href="/login">log in</a> to view your job postings.</p>
  {:else if $userStore.profile?.account_type !== 'hiring_manager'}
    <p class="message error">Only hiring managers can view posted jobs.</p>
  {:else if loading}
    <p>Loading your job listings...</p>
  {:else if error}
    <p class="message error">{error}</p>
  {:else if jobs.length === 0}
    <div class="empty-state">
      <p>You haven't posted any jobs yet.</p>
      <p>Get started by clicking the "Post New Job" button above.</p>
    </div>
  {:else}
    <div class="jobs-list">
      {#each jobs as job}
        <div class="job-card">
          <div class="job-header">
            <h3>{job.title}</h3>
            <div class="job-status {job.is_active ? 'active' : 'inactive'}">
              {job.is_active ? 'Active' : 'Inactive'}
            </div>
          </div>
          
          <div class="job-details">
            <p class="company">{job.company_name}</p>
            <p class="location"><i class="location-icon">📍</i> {job.location}</p>
            <p class="job-type">{job.job_type}</p>
            
            {#if job.salary_min || job.salary_max}
              <p class="salary">
                {#if job.salary_min && job.salary_max}
                  {job.salary_currency} {job.salary_min.toLocaleString()} - {job.salary_max.toLocaleString()}
                {:else if job.salary_min}
                  {job.salary_currency} {job.salary_min.toLocaleString()}+
                {:else if job.salary_max}
                  Up to {job.salary_currency} {job.salary_max.toLocaleString()}
                {/if}
              </p>
            {/if}
            
            <p class="posting-date">Posted: {formatDate(job.created_at)}</p>
          </div>
          
          <div class="job-actions">
            <button class="btn-secondary view-btn" on:click={() => goto(`/jobs/${job.id}`)}>
              View Details
            </button>
            <button class="btn-secondary edit-btn" on:click={() => goto(`/jobs/${job.id}/edit`)}>
              Edit
            </button>
            <button 
              class="btn-secondary toggle-btn {job.is_active ? 'deactivate' : 'activate'}" 
              on:click={() => toggleJobStatus(job.id, job.is_active)}
            >
              {job.is_active ? 'Deactivate' : 'Activate'}
            </button>
            <button class="btn-secondary applications-btn" on:click={() => goto(`/jobs/${job.id}/applications`)}>
              Applications
            </button>
            <button class="btn-secondary delete-btn" on:click={() => deleteJob(job.id)}>
              Delete
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .jobs-page {
    max-width: 900px;
    margin: var(--spacing-lg) auto;
  }
  
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-lg);
  }
  
  .new-job-btn {
    display: inline-flex;
    align-items: center;
    padding: var(--spacing-sm) var(--spacing-md);
  }
  
  .empty-state {
    text-align: center;
    padding: var(--spacing-xl);
    background-color: var(--surface-secondary-color, #f3f4f6);
    border-radius: var(--border-radius);
    margin-top: var(--spacing-lg);
  }
  
  .jobs-list {
    display: grid;
    gap: var(--spacing-md);
  }
  
  .job-card {
    background-color: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-md);
    transition: box-shadow 0.2s;
  }
  
  .job-card:hover {
    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
  }
  
  .job-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
    padding-bottom: var(--spacing-sm);
    border-bottom: 1px solid var(--border-color);
  }
  
  .job-header h3 {
    margin: 0;
    font-size: 1.25rem;
  }
  
  .job-status {
    font-size: 0.875rem;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
  }
  
  .job-status.active {
    background-color: var(--success-bg-color, #dcfce7);
    color: var(--success-text-color, #166534);
  }
  
  .job-status.inactive {
    background-color: var(--error-bg-color, #fee2e2);
    color: var(--error-text-color, #b91c1c);
  }
  
  .job-details {
    margin-bottom: var(--spacing-md);
    color: var(--text-muted-color);
    font-size: 0.875rem;
  }
  
  .job-details p {
    margin: 0.25rem 0;
  }
  
  .company {
    font-weight: 500;
    color: var(--text-color);
  }
  
  .location {
    display: flex;
    align-items: center;
  }
  
  .location-icon {
    margin-right: 0.375rem;
    font-style: normal;
  }
  
  .job-type {
    display: inline-block;
    background-color: var(--surface-secondary-color, #f3f4f6);
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    margin-top: 0.5rem;
  }
  
  .posting-date {
    margin-top: 0.5rem;
    font-size: 0.75rem;
    color: var(--text-light-color);
  }
  
  .job-actions {
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
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: 0.875rem;
    background-color: var(--background-color, white);
    color: var(--text-color);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: background-color 0.2s ease, border-color 0.2s ease;
  }
  
  .btn-secondary:hover {
    background-color: var(--background-hover-color, #f9fafb);
    border-color: var(--text-muted-color);
  }
  
  .view-btn {
    color: var(--primary-color);
    border-color: var(--primary-color);
  }
  
  .edit-btn {
    color: var(--secondary-color, #14b8a6);
    border-color: var(--secondary-color, #14b8a6);
  }
  
  .toggle-btn.deactivate {
    color: var(--warning-text-color, #c2410c);
    border-color: var(--warning-border-color, #fdba74);
  }
  
  .toggle-btn.activate {
    color: var(--success-text-color, #166534);
    border-color: var(--success-border-color, #86efac);
  }
  
  .applications-btn {
    color: var(--info-text-color, #0369a1);
    border-color: var(--info-border-color, #93c5fd);
  }
  
  .delete-btn {
    color: var(--error-text-color, #b91c1c);
    border-color: var(--error-border-color, #fca5a5);
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
  
  a {
    color: var(--primary-color);
    text-decoration: none;
  }
  
  a:hover {
    text-decoration: underline;
  }
</style> 