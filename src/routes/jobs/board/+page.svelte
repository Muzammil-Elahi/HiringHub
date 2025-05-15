<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';
  import userStore from '$lib/stores/userStore';
  import { calculateMatchPercentage, extractResumeText } from '$lib/utils/matchingAlgorithm';

  // Get server-loaded data
  export let data;

  // Job search state
  let jobs = data.jobs || [];
  let filteredJobs = [...jobs];
  let loading = false;
  let error = '';

  // Filter state
  let searchQuery = '';
  let selectedJobType = '';
  let selectedLocation = '';
  let minSalary: number | null = null;
  let locations: string[] = [];
  let jobTypes: string[] = [];
  
  // Match sorting
  let sortByMatch = false;
  let resumeText = '';
  let matchPercentages: Record<string, number> = {}; // Job ID to match percentage
  let resumeLoading = false;
  let resumeLoadError = '';

  // Keep track of applied jobs
  let appliedJobs: Record<string, boolean> = {};
  let checkingApplications = false;
  
  // Track current focus for keyboard navigation
  let focusedJobIndex = -1;
  let jobCardsRef: HTMLDivElement;

  // Initialize filters from loaded jobs
  function initializeFilters() {
    // Extract unique locations and job types for filters
    const uniqueLocations = new Set<string>();
    const uniqueJobTypes = new Set<string>();
    
    jobs.forEach(job => {
      if (job.location) uniqueLocations.add(job.location);
      if (job.job_type) uniqueJobTypes.add(job.job_type);
    });
    
    locations = Array.from(uniqueLocations);
    jobTypes = Array.from(uniqueJobTypes);
  }

  // Check which jobs the user has already applied to
  async function checkUserApplications() {
    if (!$userStore.loggedIn || !$userStore.user || $userStore.profile?.account_type !== 'job_seeker') {
      return;
    }
    
    try {
      checkingApplications = true;
      const { data: applications, error } = await supabase
        .from('applications')
        .select('job_id')
        .eq('job_seeker_id', $userStore.user.id);
      
      if (error) throw error;
      
      // Create a map of job_id -> true for quick lookup
      appliedJobs = applications.reduce((acc, app) => {
        acc[app.job_id] = true;
        return acc;
      }, {} as Record<string, boolean>);
      
    } catch (err) {
      console.error('Error checking job applications:', err);
    } finally {
      checkingApplications = false;
    }
  }

  // Load resume text and calculate match percentages
  async function loadResumeAndCalculateMatches() {
    if (!$userStore.loggedIn || !$userStore.profile || $userStore.profile.account_type !== 'job_seeker') {
      return;
    }
    
    const resumeUrl = $userStore.profile.resume_url;
    if (!resumeUrl) {
      resumeLoadError = 'No resume found. Please upload a resume in your profile to see job matches.';
      return;
    }
    
    resumeLoading = true;
    resumeLoadError = '';
    
    try {
      // Extract text from resume
      resumeText = await extractResumeText(resumeUrl);
      
      if (!resumeText) {
        resumeLoadError = 'Could not extract text from resume. Match percentages will not be available.';
        return;
      }
      
      // Calculate match percentages for all jobs
      jobs.forEach(job => {
        matchPercentages[job.id] = calculateMatchPercentage(resumeText, job);
      });
      
      // If sorting by match is enabled, sort the filtered jobs
      if (sortByMatch) {
        sortJobsByMatch();
      }
      
    } catch (error) {
      console.error('Error loading resume or calculating matches:', error);
      resumeLoadError = 'Error calculating job matches';
    } finally {
      resumeLoading = false;
    }
  }
  
  // Sort jobs by match percentage
  function sortJobsByMatch() {
    filteredJobs = [...filteredJobs].sort((a, b) => {
      const matchA = matchPercentages[a.id] || 0;
      const matchB = matchPercentages[b.id] || 0;
      return matchB - matchA; // Sort by highest match first
    });
  }

  // Apply filters to jobs
  function applyFilters() {
    filteredJobs = jobs.filter(job => {
      // Search query filter
      const matchesSearch = searchQuery ? 
        (job.title?.toLowerCase().includes(searchQuery.toLowerCase()) || 
         job.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
         job.company_name?.toLowerCase().includes(searchQuery.toLowerCase()))
        : true;
      
      // Job type filter
      const matchesJobType = selectedJobType ? 
        job.job_type === selectedJobType : true;
      
      // Location filter
      const matchesLocation = selectedLocation ? 
        job.location === selectedLocation : true;
      
      // Salary filter
      const matchesSalary = minSalary ? 
        (job.salary_max ? job.salary_max >= minSalary : false) : true;
      
      return matchesSearch && matchesJobType && matchesLocation && matchesSalary;
    });
    
    // Sort by match if enabled
    if (sortByMatch) {
      sortJobsByMatch();
    }
    
    // Reset focused job index when filters change
    focusedJobIndex = -1;
    
    // Announce results to screen readers
    announceSearchResults();
  }
  
  // Announce search results to screen readers
  function announceSearchResults() {
    const resultsAnnouncement = document.getElementById('search-results-announcement');
    if (resultsAnnouncement) {
      resultsAnnouncement.textContent = `Found ${filteredJobs.length} job${filteredJobs.length === 1 ? '' : 's'} matching your criteria.`;
    }
  }

  // Handle filter changes
  function handleSearch() {
    applyFilters();
  }

  function handleFilterChange() {
    applyFilters();
  }

  function resetFilters() {
    searchQuery = '';
    selectedJobType = '';
    selectedLocation = '';
    minSalary = null;
    sortByMatch = false;
    filteredJobs = [...jobs];
    
    // Announce reset to screen readers
    const resultsAnnouncement = document.getElementById('search-results-announcement');
    if (resultsAnnouncement) {
      resultsAnnouncement.textContent = 'Filters have been reset. Showing all jobs.';
    }
  }
  
  // Toggle sort by match
  function toggleSortByMatch() {
    sortByMatch = !sortByMatch;
    
    if (sortByMatch) {
      sortJobsByMatch();
      
      // Announce sort change to screen readers
      const resultsAnnouncement = document.getElementById('search-results-announcement');
      if (resultsAnnouncement) {
        resultsAnnouncement.textContent = 'Jobs sorted by match percentage.';
      }
    } else {
      // Reset to default sort (latest first)
      filteredJobs = [...filteredJobs].sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      
      // Announce sort change to screen readers
      const resultsAnnouncement = document.getElementById('search-results-announcement');
      if (resultsAnnouncement) {
        resultsAnnouncement.textContent = 'Jobs sorted by most recent.';
      }
    }
  }

  // Apply to job
  async function applyToJob(jobId: string) {
    if (!$userStore.loggedIn) {
      goto('/login?redirect=/jobs/board');
      return;
    }
    
    if ($userStore.profile?.account_type !== 'job_seeker') {
      error = 'Only job seekers can apply to jobs.';
      return;
    }
    
    // Redirect to the job detail page instead of apply page
    goto(`/jobs/${jobId}`);
  }
  
  // Handle keyboard navigation
  function handleJobListKeyDown(event: KeyboardEvent) {
    const jobElements = jobCardsRef?.querySelectorAll('.job-card');
    if (!jobElements || jobElements.length === 0) return;
    
    // Handle arrow key navigation
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      focusedJobIndex = Math.min(focusedJobIndex + 1, jobElements.length - 1);
      (jobElements[focusedJobIndex] as HTMLElement).focus();
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      focusedJobIndex = Math.max(focusedJobIndex - 1, 0);
      (jobElements[focusedJobIndex] as HTMLElement).focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      focusedJobIndex = 0;
      (jobElements[focusedJobIndex] as HTMLElement).focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      focusedJobIndex = jobElements.length - 1;
      (jobElements[focusedJobIndex] as HTMLElement).focus();
    }
  }
  
  // Format salary range for display
  function formatSalary(min: number | null, max: number | null): string {
    if (!min && !max) return 'Salary not specified';
    
    const formatNumber = (num: number) => {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumFractionDigits: 0
      }).format(num);
    };
    
    if (min && max) {
      return `${formatNumber(min)} - ${formatNumber(max)}`;
    } else if (min) {
      return `From ${formatNumber(min)}`;
    } else if (max) {
      return `Up to ${formatNumber(max)}`;
    }
    
    return 'Salary not specified';
  }

  // Get the match level for styling
  function getMatchLevel(percentage: number): string {
    if (percentage >= 75) return 'high';
    if (percentage >= 50) return 'medium';
    return 'low';
  }

  onMount(() => {
    // Initialize filters on mount
    initializeFilters();
    
    // Check user applications
    checkUserApplications();
    
    // Load resume and calculate matches if user is logged in
    if ($userStore.loggedIn && $userStore.profile?.account_type === 'job_seeker') {
      loadResumeAndCalculateMatches();
    }
  });
</script>

<svelte:head>
  <title>Job Board - HiringHub</title>
  <meta name="description" content="Browse and search for job opportunities on HiringHub">
</svelte:head>

<div class="job-board-container" role="main" aria-labelledby="job-board-title">
  <h1 id="job-board-title">Job Board</h1>
  
  <!-- Screen reader announcements -->
  <div id="search-results-announcement" class="sr-only" aria-live="polite" aria-atomic="true"></div>
  
  <div class="job-board-content">
    <!-- Filters section -->
    <section class="filters-section" aria-labelledby="filters-heading">
      <h2 id="filters-heading">Search and Filter</h2>
      
      <div class="search-bar">
        <label for="search-input" class="sr-only">Search jobs</label>
        <input 
          id="search-input" 
          type="search" 
          bind:value={searchQuery} 
          placeholder="Search jobs by title, company, or keywords"
          aria-label="Search jobs by title, company, or keywords"
        />
        <button 
          class="search-button" 
          on:click={handleSearch}
          aria-label="Search jobs"
        >
          <span aria-hidden="true">🔍</span>
        </button>
      </div>
      
      <div class="filter-options">
        <div class="filter-row">
          <div class="filter-group">
            <label for="job-type-filter">Job Type</label>
            <select
              id="job-type-filter"
              bind:value={selectedJobType}
              on:change={handleFilterChange}
              aria-label="Filter by job type"
            >
              <option value="">All Types</option>
              {#each jobTypes as jobType}
                <option value={jobType}>{jobType}</option>
              {/each}
            </select>
          </div>
          
          <div class="filter-group">
            <label for="location-filter">Location</label>
            <select
              id="location-filter"
              bind:value={selectedLocation}
              on:change={handleFilterChange}
              aria-label="Filter by location"
            >
              <option value="">All Locations</option>
              {#each locations as location}
                <option value={location}>{location}</option>
              {/each}
            </select>
          </div>
          
          <div class="filter-group">
            <label for="salary-filter">Minimum Salary</label>
            <select
              id="salary-filter"
              bind:value={minSalary}
              on:change={handleFilterChange}
              aria-label="Filter by minimum salary"
            >
              <option value={null}>Any Salary</option>
              <option value={30000}>$30,000+</option>
              <option value={50000}>$50,000+</option>
              <option value={75000}>$75,000+</option>
              <option value={100000}>$100,000+</option>
              <option value={150000}>$150,000+</option>
            </select>
          </div>
        </div>
        
        <div class="filter-actions">
          <button 
            class="reset-button" 
            on:click={resetFilters}
            aria-label="Reset all filters"
          >
            Reset Filters
          </button>
          
          {#if $userStore.loggedIn && $userStore.profile?.account_type === 'job_seeker'}
            <div class="match-toggle-wrapper">
              <button 
                class="match-toggle-btn {sortByMatch ? 'active' : ''}"
                on:click={toggleSortByMatch}
                aria-pressed={sortByMatch}
                aria-label="Sort by resume match percentage"
              >
                <span class="match-toggle-icon" aria-hidden="true">
                  {#if sortByMatch}✓{/if}
                </span>
                <span>Sort by Match</span>
                {#if resumeLoading}
                  <span class="loading-indicator" aria-hidden="true">⟳</span>
                  <span class="sr-only">Loading resume data</span>
                {/if}
              </button>
            </div>
          {/if}
        </div>
      </div>
      
      {#if resumeLoadError}
        <div class="resume-error" role="alert">
          <p>{resumeLoadError}</p>
        </div>
      {/if}
    </section>
    
    <!-- Jobs listing section -->
    <section class="jobs-section" aria-labelledby="jobs-listing-heading">
      <h2 id="jobs-listing-heading" class="sr-only">Jobs Listing</h2>
      
      {#if loading}
        <div class="loading-state" aria-live="polite" role="status">
          <p>Loading jobs...</p>
        </div>
      {:else if error}
        <div class="error-state" role="alert">
          <p>{error}</p>
        </div>
      {:else if filteredJobs.length === 0}
        <div class="empty-state" aria-live="polite">
          <h3>No jobs found</h3>
          <p>Try adjusting your search criteria or check back later for new opportunities.</p>
        </div>
      {:else}
        <div 
          class="job-cards" 
          bind:this={jobCardsRef} 
          on:keydown={handleJobListKeyDown}
          role="list"
          aria-label="List of jobs"
        >
          {#each filteredJobs as job, index (job.id)}
            <div 
              class="job-card" 
              role="listitem"
              tabindex="0"
              on:click={() => goto(`/jobs/${job.id}`)}
              on:keydown={(e) => e.key === 'Enter' && goto(`/jobs/${job.id}`)}
            >
              <div class="job-header">
                <h3 class="job-title">{job.title}</h3>
                {#if $userStore.loggedIn && $userStore.profile?.account_type === 'job_seeker' && matchPercentages[job.id] !== undefined}
                  <div 
                    class="match-percentage match-{getMatchLevel(matchPercentages[job.id])}" 
                    aria-label="Match percentage: {matchPercentages[job.id]}%"
                  >
                    <span class="match-label">Match</span>
                    <span class="match-value">{matchPercentages[job.id]}%</span>
                  </div>
                {/if}
              </div>
              
              <div class="job-company">
                <span class="company-name">{job.company_name}</span>
              </div>
              
              <div class="job-details">
                {#if job.location}
                  <div class="job-location" aria-label="Location: {job.location}">
                    <span aria-hidden="true">📍</span> {job.location}
                  </div>
                {/if}
                
                {#if job.job_type}
                  <div class="job-type" aria-label="Job type: {job.job_type}">
                    <span aria-hidden="true">🕒</span> {job.job_type}
                  </div>
                {/if}
                
                <div class="job-salary" aria-label="Salary: {formatSalary(job.salary_min, job.salary_max)}">
                  <span aria-hidden="true">💰</span> {formatSalary(job.salary_min, job.salary_max)}
                </div>
              </div>
              
              <div class="job-description">
                <p>{job.description?.substring(0, 150)}...</p>
              </div>
              
              <div class="job-footer">
                <div class="job-date" aria-label="Posted {new Date(job.created_at).toLocaleDateString()}">
                  Posted: {new Date(job.created_at).toLocaleDateString()}
                </div>
                
                {#if appliedJobs[job.id]}
                  <div class="applied-status" aria-label="You have applied to this job">
                    <span aria-hidden="true">✓</span> Applied
                  </div>
                {:else}
                  <button 
                    class="apply-button" 
                    on:click|stopPropagation={(e) => {
                      e.preventDefault();
                      applyToJob(job.id);
                    }}
                    aria-label="Apply to {job.title} at {job.company_name}"
                  >
                    Apply Now
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  </div>
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
    border: 0;
  }

  .job-board-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: var(--spacing-lg);
  }
  
  h1 {
    margin-bottom: var(--spacing-lg);
    color: var(--heading-color);
  }
  
  .job-board-content {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-lg);
  }
  
  /* Filters section */
  .filters-section {
    background-color: var(--surface-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-lg);
    border: 1px solid var(--border-color);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }
  
  .filters-section h2 {
    margin-top: 0;
    margin-bottom: var(--spacing-md);
    font-size: 1.25rem;
    color: var(--heading-color);
  }
  
  .search-bar {
    display: flex;
    margin-bottom: var(--spacing-md);
  }
  
  .search-bar input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius) 0 0 var(--border-radius);
    font-size: 1rem;
  }
  
  .search-bar input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px var(--focus-ring-color);
  }
  
  .search-button {
    padding: 0.75rem 1rem;
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: 0 var(--border-radius) var(--border-radius) 0;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .search-button:hover, .search-button:focus {
    background-color: var(--primary-color-dark);
  }
  
  .search-button:focus {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
  }
  
  .filter-options {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-md);
  }
  
  .filter-row {
    display: flex;
    gap: var(--spacing-md);
    flex-wrap: wrap;
  }
  
  .filter-group {
    flex: 1;
    min-width: 200px;
  }
  
  .filter-group label {
    display: block;
    margin-bottom: var(--spacing-xs);
    font-weight: 500;
  }
  
  .filter-group select {
    width: 100%;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background-color: var(--surface-color);
    font-size: 1rem;
    appearance: none;
    background-image: url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='%23333'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 0.75rem center;
    background-size: 1.25rem;
  }
  
  .filter-group select:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px var(--focus-ring-color);
  }
  
  .filter-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: var(--spacing-md);
    margin-top: var(--spacing-xs);
  }
  
  .reset-button {
    padding: 0.5rem 1rem;
    background-color: var(--surface-color);
    color: var(--text-color);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .reset-button:hover, .reset-button:focus {
    background-color: var(--hover-color);
  }
  
  .reset-button:focus {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
  }
  
  .match-toggle-wrapper {
    display: flex;
    align-items: center;
  }
  
  .match-toggle-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    background-color: var(--surface-color);
    border: 1px solid var(--border-color);
    padding: 0.5rem 1rem;
    border-radius: var(--border-radius);
    cursor: pointer;
    transition: all 0.2s ease;
    font-weight: 500;
  }
  
  .match-toggle-btn.active {
    background-color: var(--primary-color-light, #e0f2fe);
    border-color: var(--primary-color);
    color: var(--primary-color-dark);
  }
  
  .match-toggle-btn:hover {
    background-color: var(--hover-color);
  }
  
  .match-toggle-btn:focus {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
  }
  
  .match-toggle-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.25rem;
    height: 1.25rem;
    border: 1px solid currentColor;
    border-radius: 0.25rem;
  }
  
  .match-toggle-btn.active .match-toggle-icon {
    background-color: var(--primary-color);
    border-color: var(--primary-color);
    color: white;
  }
  
  .match-percentage {
    padding: 0.25rem 0.5rem;
    border-radius: var(--border-radius);
    font-size: 0.875rem;
    font-weight: 500;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-width: 3.5rem;
    color: white;
  }
  
  .match-high {
    background-color: var(--success-color, #10b981);
  }
  
  .match-medium {
    background-color: var(--warning-color, #f59e0b);
  }
  
  .match-low {
    background-color: var(--error-color, #ef4444);
  }
  
  .match-label {
    font-size: 0.75rem;
    opacity: 0.8;
  }
  
  .match-value {
    font-weight: 700;
  }
  
  .resume-error {
    margin-top: var(--spacing-md);
    padding: var(--spacing-sm);
    border-radius: var(--border-radius);
    background-color: var(--error-bg-color, #fee2e2);
    color: var(--error-text-color, #b91c1c);
    border-left: 4px solid var(--error-text-color, #b91c1c);
  }
  
  .resume-error p {
    margin: 0;
  }
  
  /* Jobs section */
  .jobs-section {
    flex: 1;
  }
  
  .loading-state, .error-state, .empty-state {
    padding: var(--spacing-lg);
    border-radius: var(--border-radius);
    background-color: var(--surface-color);
    border: 1px solid var(--border-color);
    text-align: center;
  }
  
  .error-state {
    background-color: var(--error-bg-color, #fee2e2);
    border-color: var(--error-text-color, #b91c1c);
  }
  
  .empty-state h3 {
    margin-top: 0;
  }
  
  .job-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: var(--spacing-lg);
  }
  
  .job-card {
    background-color: var(--surface-color);
    border-radius: var(--border-radius);
    border: 1px solid var(--border-color);
    padding: var(--spacing-lg);
    display: flex;
    flex-direction: column;
    cursor: pointer;
    transition: transform 0.2s, box-shadow 0.2s;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
    position: relative;
    overflow: hidden;
  }
  
  .job-card:hover, .job-card:focus {
    transform: translateY(-4px);
    box-shadow: 0 10px 15px rgba(0, 0, 0, 0.1);
  }
  
  .job-card:focus {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
  }
  
  .job-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--spacing-md);
  }
  
  .job-title {
    margin: 0;
    font-size: 1.25rem;
    color: var(--heading-color);
    font-weight: 600;
  }
  
  .job-company {
    margin-bottom: var(--spacing-md);
  }
  
  .company-name {
    font-weight: 500;
    color: var(--primary-color);
    font-size: 1.1rem;
  }
  
  .job-details {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-md);
    margin-bottom: var(--spacing-md);
    color: var(--text-color-secondary);
    font-size: 0.95rem;
  }
  
  .job-location, .job-type, .job-salary {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }
  
  .job-description {
    flex: 1;
    margin-bottom: var(--spacing-md);
    color: var(--text-color);
    line-height: 1.5;
  }
  
  .job-description p {
    margin: 0;
  }
  
  .job-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid var(--border-color);
    padding-top: var(--spacing-md);
  }
  
  .job-date {
    font-size: 0.875rem;
    color: var(--text-color-secondary);
  }
  
  .apply-button {
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--border-radius);
    padding: 0.5rem 1rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .apply-button:hover, .apply-button:focus {
    background-color: var(--primary-color-dark);
  }
  
  .apply-button:focus {
    outline: 2px solid var(--focus-ring-color);
    outline-offset: 2px;
  }
  
  .applied-status {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    color: var(--success-text-color, #166534);
    font-weight: 500;
    background-color: var(--success-bg-color, #dcfce7);
    padding: 0.5rem 1rem;
    border-radius: var(--border-radius);
  }
  
  /* Animations */
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  
  /* Responsive styles */
  @media (max-width: 768px) {
    .filter-row {
      flex-direction: column;
      gap: var(--spacing-md);
    }
    
    .job-cards {
      grid-template-columns: 1fr;
    }
    
    .job-footer {
      flex-direction: column;
      gap: var(--spacing-md);
      align-items: flex-start;
    }
    
    .apply-button {
      width: 100%;
    }
  }
  
  /* Reduced motion preference */
  @media (prefers-reduced-motion: reduce) {
    .job-card {
      transition: none;
    }
    
    .loading-indicator {
      animation: none;
    }
  }
</style> 