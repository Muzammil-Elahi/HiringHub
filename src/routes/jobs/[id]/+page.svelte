<script lang="ts">
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';
  import userStore from '$lib/stores/userStore';

  // Get data from page load
  export let data;

  let job = data.job;
  let loading = false;
  let message = '';
  let messageType: 'success' | 'error' = 'error';
  let applicationStats = {
    total: 0,
    pending: 0,
    reviewed: 0,
    rejected: 0
  };
  
  // Load application stats if user is the hiring manager
  async function loadApplicationStats() {
    if (!$userStore.loggedIn || !$userStore.user || $userStore.user.id !== job.hiring_manager_id) return;
    
    try {
      const { data: stats, error } = await supabase
        .from('applications')
        .select('status')
        .eq('job_id', job.id);
      
      if (error) throw error;
      
      applicationStats = {
        total: stats.length,
        pending: stats.filter(a => a.status === 'pending').length,
        reviewed: stats.filter(a => a.status === 'reviewed').length,
        rejected: stats.filter(a => a.status === 'rejected').length
      };
    } catch (err) {
      console.error('Error loading application stats:', err);
    }
  }
  
  // Apply to job
  async function applyToJob() {
    if (!$userStore.loggedIn) {
      goto('/login');
      return;
    }
    
    if ($userStore.profile?.account_type !== 'job_seeker') {
      message = 'Only job seekers can apply to jobs.';
      messageType = 'error';
      return;
    }
    
    try {
      loading = true;
      message = '';
      
      // Check if user has already applied
      const { data: existingApplication, error: checkError } = await supabase
        .from('applications')
        .select('*')
        .eq('job_id', job.id)
        .eq('job_seeker_id', $userStore.user?.id)
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      if (existingApplication) {
        message = 'You have already applied to this job.';
        messageType = 'error';
        return;
      }
      
      // Create application
      const { error: applyError } = await supabase
        .from('applications')
        .insert({
          job_id: job.id,
          job_seeker_id: $userStore.user?.id,
          application_date: new Date().toISOString(),
          status: 'pending',
          cover_letter: '',
          resume_snapshot_url: $userStore.profile?.resume_url || '',
        });
      
      if (applyError) throw applyError;
      
      message = 'Application submitted successfully!';
      messageType = 'success';
      
    } catch (err: any) {
      console.error('Error applying to job:', err);
      message = `Failed to apply: ${err.message}`;
      messageType = 'error';
    } finally {
      loading = false;
    }
  }

  // Toggle job status (active/inactive)
  async function toggleJobStatus() {
    if (!$userStore.loggedIn || !$userStore.user || $userStore.user.id !== job.hiring_manager_id) return;
    
    try {
      loading = true;
      const { error } = await supabase
        .from('jobs')
        .update({ is_active: !job.is_active })
        .eq('id', job.id);
      
      if (error) throw error;
      
      job.is_active = !job.is_active;
      message = `Job ${job.is_active ? 'activated' : 'deactivated'} successfully`;
      messageType = 'success';
    } catch (err: any) {
      console.error('Error toggling job status:', err);
      message = `Failed to update job status: ${err.message}`;
      messageType = 'error';
    } finally {
      loading = false;
    }
  }

  // Delete job
  async function deleteJob() {
    if (!$userStore.loggedIn || !$userStore.user || $userStore.user.id !== job.hiring_manager_id) return;
    
    if (!confirm('Are you sure you want to delete this job posting? This action cannot be undone.')) {
      return;
    }
    
    try {
      loading = true;
      const { error } = await supabase
        .from('jobs')
        .delete()
        .eq('id', job.id);
      
      if (error) throw error;
      
      goto('/profile/hiring-manager/jobs');
    } catch (err: any) {
      console.error('Error deleting job:', err);
      message = `Failed to delete job: ${err.message}`;
      messageType = 'error';
    } finally {
      loading = false;
    }
  }

  // Format currency
  function formatSalary(min: number | null, max: number | null, currency: string) {
    if (!min && !max) return 'Salary not specified';
    
    if (min && max) {
      return `${currency} ${min.toLocaleString()} - ${max.toLocaleString()}`;
    } else if (min) {
      return `${currency} ${min.toLocaleString()}+`;
    } else if (max) {
      return `Up to ${currency} ${max.toLocaleString()}`;
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

  // Determine back link based on user type
  $: backLink = $userStore.profile?.account_type === 'hiring_manager' 
    ? '/profile/hiring-manager/jobs'
    : '/jobs/board';

  // Load application stats on mount if user is hiring manager
  $: if (job && $userStore.user?.id === job.hiring_manager_id) {
    loadApplicationStats();
  }
</script>

<div class="container job-detail-page">
  <div class="back-link">
    <a href={backLink}>&larr; Back to {backLink.includes('profile') ? 'your jobs' : 'all jobs'}</a>
  </div>
  
  {#if !job}
    <div class="error-state">
      <p>Job not found or has been removed.</p>
      <a href={backLink} class="btn-primary">View All Jobs</a>
    </div>
  {:else}
    {#if message}
      <div class="message {messageType}">
        <p>{message}</p>
      </div>
    {/if}

    <div class="job-header">
      <div class="job-title-area">
        <h1>{job.title}</h1>
        <p class="company-name">{job.company_name}</p>
        <p class="job-location"><i class="location-icon">📍</i> {job.location}</p>
        {#if $userStore.user?.id === job.hiring_manager_id}
          <div class="job-status {job.is_active ? 'active' : 'inactive'}">
            {job.is_active ? 'Active' : 'Inactive'}
          </div>
        {/if}
      </div>
      
      {#if $userStore.loggedIn && $userStore.profile?.account_type === 'job_seeker'}
        <button class="apply-btn" on:click={applyToJob} disabled={loading}>
          {loading ? 'Submitting...' : 'Apply Now'}
        </button>
      {:else if !$userStore.loggedIn}
        <a href="/login" class="login-btn">Log in to Apply</a>
      {/if}
    </div>
    
    <div class="job-content">
      <div class="job-main">
        <div class="job-overview">
          <div class="overview-item">
            <span class="label">Job Type</span>
            <span class="value job-type">{job.job_type}</span>
          </div>
          
          {#if job.salary_min || job.salary_max}
            <div class="overview-item">
              <span class="label">Salary</span>
              <span class="value salary">{formatSalary(job.salary_min, job.salary_max, job.salary_currency)}</span>
            </div>
          {/if}
          
          <div class="overview-item">
            <span class="label">Posted</span>
            <span class="value">{formatDate(job.created_at)}</span>
          </div>
        </div>
        
        {#if job.job_skills && job.job_skills.length > 0}
          <div class="job-skills">
            <h3>Required Skills</h3>
            <div class="skills-list">
              {#each job.job_skills as skill}
                <span class="skill-tag">{skill.skill_name}</span>
              {/each}
            </div>
          </div>
        {/if}
        
        <div class="job-description">
          <h3>Job Description</h3>
          <div class="description-text">
            {#each job.description.split('\n') as paragraph}
              <p>{paragraph}</p>
            {/each}
          </div>
        </div>
      </div>
      
      <div class="job-sidebar">
        {#if $userStore.user?.id === job.hiring_manager_id}
          <div class="manager-actions">
            <h3>Job Management</h3>
            <div class="action-buttons">
              <button class="btn-secondary" on:click={() => goto(`/jobs/${job.id}/edit`)}>
                Edit Job
              </button>
              <button 
                class="btn-secondary {job.is_active ? 'deactivate' : 'activate'}" 
                on:click={toggleJobStatus}
                disabled={loading}
              >
                {job.is_active ? 'Deactivate' : 'Activate'}
              </button>
              <button class="btn-secondary delete" on:click={deleteJob} disabled={loading}>
                Delete Job
              </button>
            </div>
            
            <div class="application-stats">
              <h4>Applications</h4>
              <div class="stats-grid">
                <div class="stat-item">
                  <span class="stat-value">{applicationStats.total}</span>
                  <span class="stat-label">Total</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value">{applicationStats.pending}</span>
                  <span class="stat-label">Pending</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value">{applicationStats.reviewed}</span>
                  <span class="stat-label">Reviewed</span>
                </div>
                <div class="stat-item">
                  <span class="stat-value">{applicationStats.rejected}</span>
                  <span class="stat-label">Rejected</span>
                </div>
              </div>
              <a href={`/jobs/${job.id}/applications`} class="view-applications">
                View All Applications
              </a>
            </div>
          </div>
        {:else}
          <div class="company-card">
            <h3>About {job.company_name}</h3>
            {#if job.company_website}
              <a href={job.company_website} target="_blank" rel="noopener noreferrer" class="company-website">
                <i class="website-icon">🔗</i> Company Website
              </a>
            {/if}
          </div>
          
          <div class="action-card">
            <h3>Interested in this job?</h3>
            {#if $userStore.loggedIn && $userStore.profile?.account_type === 'job_seeker'}
              <button class="apply-btn full-width" on:click={applyToJob} disabled={loading}>
                {loading ? 'Submitting...' : 'Apply Now'}
              </button>
            {:else if !$userStore.loggedIn}
              <a href="/login" class="login-btn full-width">Log in to Apply</a>
              <p class="not-registered">
                Not registered? <a href="/register">Create an account</a>
              </p>
            {:else}
              <p>Only job seekers can apply for jobs.</p>
            {/if}
          </div>
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  .job-detail-page {
    max-width: 1000px;
    margin: 0 auto;
    padding-bottom: var(--spacing-xl);
  }
  
  .back-link {
    margin-bottom: var(--spacing-md);
  }
  
  .back-link a {
    display: inline-flex;
    align-items: center;
    color: var(--text-color);
    text-decoration: none;
    font-size: 0.875rem;
  }
  
  .back-link a:hover {
    color: var(--primary-color);
  }
  
  .job-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--spacing-lg);
    padding-bottom: var(--spacing-md);
    border-bottom: 1px solid var(--border-color);
  }
  
  .job-title-area h1 {
    margin: 0 0 var(--spacing-xs) 0;
    font-size: 1.75rem;
    color: var(--primary-color);
  }
  
  .company-name {
    font-size: 1.125rem;
    font-weight: 500;
    margin: 0 0 var(--spacing-xs) 0;
  }
  
  .job-location {
    display: flex;
    align-items: center;
    color: var(--text-muted-color);
    font-size: 0.875rem;
    margin: 0;
  }
  
  .location-icon {
    margin-right: var(--spacing-xs);
    font-style: normal;
  }
  
  .job-status {
    display: inline-block;
    padding: 0.25rem 0.75rem;
    border-radius: 9999px;
    font-size: 0.875rem;
    margin-top: var(--spacing-sm);
  }
  
  .job-status.active {
    background-color: var(--success-bg-color, #dcfce7);
    color: var(--success-text-color, #166534);
  }
  
  .job-status.inactive {
    background-color: var(--error-bg-color, #fee2e2);
    color: var(--error-text-color, #b91c1c);
  }
  
  .apply-btn,
  .login-btn {
    padding: var(--spacing-sm) var(--spacing-lg);
    border-radius: var(--border-radius);
    font-weight: 500;
    text-align: center;
    cursor: pointer;
    display: inline-block;
    min-width: 120px;
  }
  
  .apply-btn {
    background-color: var(--primary-color);
    color: var(--primary-contrast-color);
    border: none;
  }
  
  .apply-btn:hover:not(:disabled) {
    background-color: var(--primary-color-dark);
  }
  
  .apply-btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  .login-btn {
    background-color: var(--background-color);
    color: var(--primary-color);
    border: 1px solid var(--primary-color);
    text-decoration: none;
  }
  
  .login-btn:hover {
    background-color: var(--primary-color-light, #e0f2fe);
  }
  
  .full-width {
    width: 100%;
  }
  
  .job-content {
    display: grid;
    grid-template-columns: 2fr 1fr;
    gap: var(--spacing-lg);
  }
  
  @media (max-width: 768px) {
    .job-content {
      grid-template-columns: 1fr;
    }
    
    .job-header {
      flex-direction: column;
    }
    
    .job-header .apply-btn,
    .job-header .login-btn {
      margin-top: var(--spacing-md);
      width: 100%;
    }
  }
  
  .job-overview {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-lg);
    padding: var(--spacing-md);
    background-color: var(--surface-secondary-color, #f3f4f6);
    border-radius: var(--border-radius);
  }
  
  .overview-item {
    display: flex;
    flex-direction: column;
  }
  
  .overview-item .label {
    font-size: 0.75rem;
    color: var(--text-muted-color);
    margin-bottom: var(--spacing-xs);
  }
  
  .overview-item .value {
    font-weight: 500;
  }
  
  .overview-item .job-type {
    color: var(--primary-color-dark, #1e40af);
  }
  
  .overview-item .salary {
    color: var(--success-text-color, #166534);
  }
  
  .job-skills,
  .job-description {
    margin-bottom: var(--spacing-lg);
  }
  
  .job-skills h3,
  .job-description h3 {
    margin-bottom: var(--spacing-md);
    font-size: 1.25rem;
  }
  
  .skills-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
  }
  
  .skill-tag {
    display: inline-block;
    background-color: var(--surface-secondary-color, #f3f4f6);
    color: var(--text-color);
    font-size: 0.875rem;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--border-radius);
  }
  
  .description-text {
    line-height: 1.6;
  }
  
  .description-text p {
    margin-bottom: var(--spacing-md);
  }
  
  .company-card,
  .action-card,
  .manager-actions {
    padding: var(--spacing-md);
    background-color: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    margin-bottom: var(--spacing-lg);
  }
  
  .company-card h3,
  .action-card h3,
  .manager-actions h3 {
    margin-top: 0;
    margin-bottom: var(--spacing-md);
    font-size: 1.125rem;
  }
  
  .company-website {
    display: inline-flex;
    align-items: center;
    color: var(--primary-color);
    text-decoration: none;
  }
  
  .company-website:hover {
    text-decoration: underline;
  }
  
  .website-icon {
    margin-right: var(--spacing-xs);
    font-style: normal;
  }
  
  .not-registered {
    margin-top: var(--spacing-md);
    font-size: 0.875rem;
    text-align: center;
  }
  
  .error-state {
    text-align: center;
    padding: var(--spacing-xl);
    background-color: var(--surface-secondary-color, #f3f4f6);
    border-radius: var(--border-radius);
    margin-top: var(--spacing-lg);
  }
  
  .message {
    padding: var(--spacing-md);
    border-radius: var(--border-radius);
    margin-bottom: var(--spacing-lg);
  }
  
  .message.success {
    background-color: var(--success-bg-color, #dcfce7);
    color: var(--success-text-color, #166534);
    border: 1px solid var(--success-border-color, #86efac);
  }
  
  .message.error {
    background-color: var(--error-bg-color, #fee2e2);
    color: var(--error-text-color, #b91c1c);
    border: 1px solid var(--error-border-color, #fca5a5);
  }
  
  .manager-actions .action-buttons {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-lg);
  }
  
  .btn-secondary {
    padding: var(--spacing-sm) var(--spacing-md);
    background-color: var(--background-color);
    color: var(--text-color);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    cursor: pointer;
    font-size: 0.875rem;
    text-align: center;
  }
  
  .btn-secondary:hover:not(:disabled) {
    background-color: var(--background-hover-color, #f9fafb);
    border-color: var(--text-muted-color);
  }
  
  .btn-secondary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
  
  .btn-secondary.deactivate {
    color: var(--warning-text-color, #c2410c);
    border-color: var(--warning-border-color, #fdba74);
  }
  
  .btn-secondary.activate {
    color: var(--success-text-color, #166534);
    border-color: var(--success-border-color, #86efac);
  }
  
  .btn-secondary.delete {
    color: var(--error-text-color, #b91c1c);
    border-color: var(--error-border-color, #fca5a5);
  }
  
  .application-stats {
    margin-top: var(--spacing-lg);
  }
  
  .application-stats h4 {
    margin-bottom: var(--spacing-md);
    font-size: 1rem;
  }
  
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-md);
  }
  
  .stat-item {
    text-align: center;
    padding: var(--spacing-sm);
    background-color: var(--surface-secondary-color, #f3f4f6);
    border-radius: var(--border-radius);
  }
  
  .stat-value {
    display: block;
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--primary-color);
  }
  
  .stat-label {
    font-size: 0.75rem;
    color: var(--text-muted-color);
  }
  
  .view-applications {
    display: block;
    text-align: center;
    color: var(--primary-color);
    text-decoration: none;
    font-size: 0.875rem;
    margin-top: var(--spacing-md);
  }
  
  .view-applications:hover {
    text-decoration: underline;
  }
  
  a {
    color: var(--primary-color);
  }
</style> 