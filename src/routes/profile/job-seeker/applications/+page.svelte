<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';
  import userStore from '$lib/stores/userStore';

  export let data;
  let applications = data.applications || [];
  let error = data.error || '';

  // Format date helper
  function formatDate(dateString: string) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short', 
      day: 'numeric'
    });
  }

  // Get status badge class
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

  // Format salary range
  function formatSalary(min: number | null, max: number | null, currency: string = 'USD'): string {
    if (!min && !max) return 'Not specified';
    
    const currencySymbol = getCurrencySymbol(currency);
    
    if (min && max) {
      return `${currencySymbol}${formatNumber(min)} - ${currencySymbol}${formatNumber(max)}`;
    } else if (min) {
      return `${currencySymbol}${formatNumber(min)}+`;
    } else if (max) {
      return `Up to ${currencySymbol}${formatNumber(max)}`;
    }
    
    return 'Not specified';
  }
  
  // Helper to format numbers with commas
  function formatNumber(num: number): string {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  
  // Get currency symbol based on currency code
  function getCurrencySymbol(currency: string): string {
    const symbols: Record<string, string> = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'CAD': 'CA$',
      'AUD': 'A$',
      'JPY': '¥'
    };
    
    return symbols[currency] || currency;
  }

  // Navigate to job details
  function viewJob(jobId: string) {
    goto(`/jobs/${jobId}`);
  }
</script>

<div class="container applications-page">
  <h2>My Applications</h2>
  
  {#if !$userStore.loggedIn}
    <p>Please <a href="/login">log in</a> to view your applications.</p>
  {:else if error}
    <p class="message error">{error}</p>
  {:else if applications.length === 0}
    <div class="empty-state">
      <h3>No Applications Yet</h3>
      <p>You haven't applied to any jobs yet.</p>
      <a href="/jobs/board" class="btn-primary">Browse Jobs</a>
    </div>
  {:else}
    <div class="applications-header">
      <p>Showing {applications.length} application{applications.length !== 1 ? 's' : ''}</p>
      
      <a href="/jobs/board" class="browse-jobs-link">Browse More Jobs</a>
    </div>
    
    <div class="applications-list">
      {#each applications as application (application.id)}
        <div class="application-card">
          <div class="application-main">
            <div class="job-info">
              <h3 class="job-title">{application.jobs?.title || 'Untitled Job'}</h3>
              <p class="company-name">{application.jobs?.company_name || 'Unknown Company'}</p>
              <p class="job-meta">
                <span class="job-location">{application.jobs?.location || 'No location'}</span>
                <span class="separator">•</span>
                <span class="job-type">{application.jobs?.job_type || 'Unspecified type'}</span>
              </p>
              {#if application.jobs?.salary_min || application.jobs?.salary_max}
                <p class="job-salary">
                  {formatSalary(application.jobs.salary_min, application.jobs.salary_max, application.jobs.salary_currency)}
                </p>
              {/if}
            </div>
            
            <div class="application-info">
              <div class="application-date">
                Applied on {formatDate(application.application_date)}
              </div>
              <div class={`application-status ${getStatusClass(application.status)}`}>
                {application.status || 'Pending'}
              </div>
            </div>
          </div>
          
          <div class="application-actions">
            <button class="view-job-btn" on:click={() => viewJob(application.job_id)}>
              View Job
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .applications-page {
    max-width: 800px;
    margin: var(--spacing-lg) auto;
  }
  
  h2 {
    margin-bottom: var(--spacing-lg);
  }
  
  .empty-state {
    text-align: center;
    padding: var(--spacing-xl);
    background-color: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    margin-top: var(--spacing-lg);
  }
  
  .empty-state h3 {
    margin-top: 0;
    margin-bottom: var(--spacing-md);
    color: var(--text-color);
  }
  
  .empty-state p {
    margin-bottom: var(--spacing-lg);
    color: var(--text-muted-color);
  }
  
  .applications-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-md);
  }
  
  .applications-header p {
    color: var(--text-muted-color);
    margin: 0;
  }
  
  .browse-jobs-link {
    color: var(--primary-color);
    text-decoration: none;
    font-weight: 500;
  }
  
  .browse-jobs-link:hover {
    text-decoration: underline;
  }
  
  .applications-list {
    display: grid;
    gap: var(--spacing-md);
  }
  
  .application-card {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--spacing-md);
    background-color: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.05);
  }
  
  .application-main {
    flex: 1;
    display: flex;
    justify-content: space-between;
  }
  
  .job-info {
    flex: 1;
  }
  
  .job-title {
    font-size: 1.1rem;
    margin: 0 0 var(--spacing-xs);
    color: var(--text-color);
  }
  
  .company-name {
    margin: 0 0 var(--spacing-xs);
    color: var(--text-muted-color);
    font-weight: 500;
  }
  
  .job-meta {
    margin: 0 0 var(--spacing-xs);
    color: var(--text-light-color);
    font-size: 0.875rem;
  }
  
  .separator {
    margin: 0 var(--spacing-xs);
  }
  
  .job-salary {
    margin: 0;
    color: var(--primary-color);
    font-weight: 500;
    font-size: 0.875rem;
  }
  
  .application-info {
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    margin-left: var(--spacing-md);
  }
  
  .application-date {
    font-size: 0.875rem;
    color: var(--text-light-color);
    margin-bottom: var(--spacing-xs);
  }
  
  .application-status {
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: 16px;
    font-size: 0.75rem;
    font-weight: 500;
    text-align: center;
    background-color: var(--background-secondary-color, #f3f4f6);
    color: var(--text-muted-color);
  }
  
  .status-submitted {
    background-color: var(--info-bg-color, #e0f2fe);
    color: var(--info-text-color, #0369a1);
  }
  
  .status-reviewed {
    background-color: var(--info-bg-color, #e0f2fe);
    color: var(--info-text-color, #0369a1);
  }
  
  .status-interview {
    background-color: var(--warning-bg-color, #fef3c7);
    color: var(--warning-text-color, #b45309);
  }
  
  .status-rejected {
    background-color: var(--error-bg-color, #fee2e2);
    color: var(--error-text-color, #b91c1c);
  }
  
  .status-accepted {
    background-color: var(--success-bg-color, #dcfce7);
    color: var(--success-text-color, #166534);
  }
  
  .application-actions {
    margin-left: var(--spacing-md);
  }
  
  .view-job-btn {
    padding: var(--spacing-xs) var(--spacing-md);
    background-color: var(--primary-color);
    color: var(--primary-contrast-color);
    border: none;
    border-radius: var(--border-radius);
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    transition: background-color 0.2s ease;
  }
  
  .view-job-btn:hover {
    background-color: var(--primary-color-dark);
  }
  
  .message.error {
    background-color: var(--error-bg-color, #fee2e2);
    color: var(--error-text-color, #b91c1c);
    padding: var(--spacing-md);
    border-radius: var(--border-radius);
    margin-bottom: var(--spacing-lg);
  }
  
  @media (max-width: 768px) {
    .application-card {
      flex-direction: column;
      align-items: stretch;
    }
    
    .application-main {
      flex-direction: column;
      margin-bottom: var(--spacing-md);
    }
    
    .application-info {
      flex-direction: row;
      justify-content: space-between;
      align-items: center;
      margin-left: 0;
      margin-top: var(--spacing-sm);
    }
    
    .application-date {
      margin-bottom: 0;
    }
    
    .application-actions {
      margin-left: 0;
      display: flex;
      justify-content: flex-end;
    }
  }
</style> 