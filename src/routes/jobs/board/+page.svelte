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
  }
  
  // Toggle sort by match
  function toggleSortByMatch() {
    sortByMatch = !sortByMatch;
    
    if (sortByMatch) {
      sortJobsByMatch();
    } else {
      // Reset to default sort (latest first)
      filteredJobs = [...filteredJobs].sort((a, b) => {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    }
  }

  // Apply to job
  async function applyToJob(jobId: string) {
    if (!$userStore.loggedIn) {
      goto('/login');
      return;
    }
    
    if ($userStore.profile?.account_type !== 'job_seeker') {
      alert('Only job seekers can apply to jobs.');
      return;
    }
    
    try {
      loading = true;
      
      console.log('Current user profile:', $userStore.profile);
      
      if (!$userStore.profile?.resume_url) {
        alert('Please upload a resume on your profile before applying.');
        goto('/profile/job-seeker'); // Redirect to profile to upload resume
        return;
      }
      
      // Check if user has already applied
      const { data: existingApplication, error: checkError } = await supabase
        .from('applications')
        .select('*')
        .eq('job_id', jobId)
        .eq('job_seeker_id', $userStore.user?.id)
        .maybeSingle();
      
      if (checkError) throw checkError;
      
      if (existingApplication) {
        alert('You have already applied to this job.');
        return;
      }
      
      // Create application with 1-click apply
      const resumeUrl = $userStore.profile.resume_url || '';
      console.log('Using resume URL for application:', resumeUrl);
      
      const applicationData = {
        job_id: jobId,
        job_seeker_id: $userStore.user?.id,
        application_date: new Date().toISOString(),
        status: 'Submitted',
        cover_letter: '',
        resume_snapshot_url: resumeUrl
      };
      
      console.log('Submitting application with data:', applicationData);
      
      const { data: applicationResult, error: applyError } = await supabase
        .from('applications')
        .insert(applicationData)
        .select();
      
      if (applyError) throw applyError;
      
      console.log('Application submitted successfully:', applicationResult);
      
      alert('Application submitted successfully!');
      
    } catch (err: any) {
      console.error('Error applying to job:', err);
      alert(`Failed to apply: ${err.message}`);
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

  function getTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return `${diffInSeconds} seconds ago`;
    
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    if (diffInMinutes < 60) return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
    
    return formatDate(dateString);
  }

  onMount(() => {
    initializeFilters();
    loadResumeAndCalculateMatches();
  });
</script>

<div class="container job-board-page">
  <h2>Find Your Next Career Opportunity</h2>
  
  <!-- Search and Filter Section -->
  <div class="search-filters">
    <!-- Search bar -->
    <div class="search-bar">
      <input 
        type="text" 
        placeholder="Search job title, skills, or company..." 
        bind:value={searchQuery}
        on:input={handleSearch}
      />
      <button class="search-btn" on:click={handleSearch}>Search</button>
    </div>
    
    <!-- Filters -->
    <div class="filters">
      <!-- Job Type Filter -->
      <div class="filter-group">
        <label for="job-type-filter">Job Type</label>
        <select id="job-type-filter" bind:value={selectedJobType} on:change={handleFilterChange}>
          <option value="">All Types</option>
          {#each jobTypes as jobType}
            <option value={jobType}>{jobType}</option>
          {/each}
        </select>
      </div>
      
      <!-- Location Filter -->
      <div class="filter-group">
        <label for="location-filter">Location</label>
        <select id="location-filter" bind:value={selectedLocation} on:change={handleFilterChange}>
          <option value="">All Locations</option>
          {#each locations as location}
            <option value={location}>{location}</option>
          {/each}
        </select>
      </div>
      
      <!-- Minimum Salary Filter -->
      <div class="filter-group">
        <label for="salary-filter">Minimum Salary</label>
        <input 
          id="salary-filter" 
          type="number" 
          placeholder="e.g., 50000" 
          bind:value={minSalary} 
          on:input={handleFilterChange}
        />
      </div>
      
      <!-- Match Sorting - Only show when user has a resume and is a job seeker -->
      {#if $userStore.loggedIn && $userStore.profile?.account_type === 'job_seeker' && $userStore.profile?.resume_url}
        <div class="filter-group">
          <label for="match-filter">Job Match</label>
          <div class="sort-match-container">
            <input 
              id="match-filter" 
              type="checkbox" 
              bind:checked={sortByMatch} 
              on:change={toggleSortByMatch}
            />
            <label for="match-filter" class="inline-label">Sort by best match</label>
          </div>
          {#if resumeLoading}
            <small>Calculating matches...</small>
          {/if}
        </div>
      {/if}
      
      <!-- Reset filters button -->
      <button class="reset-btn" on:click={resetFilters}>Reset Filters</button>
    </div>
    
    <!-- Show message if resume match is not available but user is a job seeker -->
    {#if $userStore.loggedIn && $userStore.profile?.account_type === 'job_seeker' && resumeLoadError}
      <div class="resume-match-message">
        <p>{resumeLoadError}</p>
        <a href="/profile/job-seeker" class="resume-link">Upload Resume</a>
      </div>
    {/if}
  </div>
  
  <!-- Results section -->
  {#if loading}
    <div class="loading-state">
      <p>Loading job listings...</p>
    </div>
  {:else if error}
    <div class="error-state">
      <p class="message error">{error}</p>
    </div>
  {:else if filteredJobs.length === 0}
    <div class="empty-state">
      <h3>No job listings found</h3>
      {#if jobs.length > 0}
        <p>Try adjusting your search criteria or removing some filters.</p>
      {:else}
        <p>There are currently no active job listings available. Please check back later.</p>
      {/if}
    </div>
  {:else}
    <div class="results-info">
      <p>Showing {filteredJobs.length} {filteredJobs.length === 1 ? 'job' : 'jobs'}</p>
    </div>
    
    <div class="job-listings">
      {#each filteredJobs as job}
        <div class="job-card">
          <div class="job-header">
            <h3 class="job-title">{job.title}</h3>
            <span class="job-timeago">{getTimeAgo(job.created_at)}</span>
          </div>
          
          <div class="job-company">
            <p class="company-name">{job.company_name}</p>
            <p class="job-location"><i class="location-icon">📍</i> {job.location}</p>
          </div>
          
          <div class="job-details">
            <span class="job-type">{job.job_type}</span>
            {#if job.salary_min || job.salary_max}
              <span class="job-salary">{formatSalary(job.salary_min, job.salary_max, job.salary_currency)}</span>
            {/if}
            
            <!-- Match percentage badge - only show if match is calculated -->
            {#if $userStore.loggedIn && $userStore.profile?.account_type === 'job_seeker' && matchPercentages[job.id] !== undefined}
              <span class="match-percentage" class:high-match={matchPercentages[job.id] >= 70} class:medium-match={matchPercentages[job.id] >= 40 && matchPercentages[job.id] < 70} class:low-match={matchPercentages[job.id] < 40}>
                {matchPercentages[job.id]}% Match
              </span>
            {/if}
          </div>
          
          {#if job.job_skills && job.job_skills.length > 0}
            <div class="job-skills">
              {#each job.job_skills as skill}
                <span class="skill-tag">{skill.skill_name}</span>
              {/each}
            </div>
          {/if}
          
          <div class="job-description">
            <p>{job.description.length > 200 ? `${job.description.slice(0, 200)}...` : job.description}</p>
          </div>
          
          <div class="job-actions">
            <button class="view-btn" on:click={() => goto(`/jobs/${job.id}`)}>
              View Details
            </button>
            <button class="apply-btn" on:click={() => applyToJob(job.id)}>
              1-Click Apply
            </button>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .job-board-page {
    max-width: 1000px;
    margin: 0 auto;
  }
  
  h2 {
    margin-bottom: var(--spacing-lg);
    text-align: center;
  }
  
  /* Search and Filter Styles */
  .search-filters {
    margin-bottom: var(--spacing-xl);
    padding: var(--spacing-md);
    background-color: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  .search-bar {
    display: flex;
    margin-bottom: var(--spacing-md);
    gap: var(--spacing-sm);
  }
  
  .search-bar input {
    flex: 1;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    font-size: var(--font-size-base);
  }
  
  .search-btn {
    padding: var(--spacing-sm) var(--spacing-lg);
    background-color: var(--primary-color);
    color: var(--primary-contrast-color);
    border: none;
    border-radius: var(--border-radius);
    cursor: pointer;
    font-weight: 500;
  }
  
  .search-btn:hover {
    background-color: var(--primary-color-dark);
  }
  
  .filters {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
    gap: var(--spacing-md);
    align-items: end;
  }
  
  .filter-group {
    display: flex;
    flex-direction: column;
  }
  
  .filter-group label {
    margin-bottom: var(--spacing-xs);
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-muted-color);
  }
  
  .inline-label {
    display: inline-flex;
    margin-left: var(--spacing-xs);
    font-weight: normal;
  }
  
  .sort-match-container {
    display: flex;
    align-items: center;
  }
  
  .filter-group select,
  .filter-group input {
    padding: var(--spacing-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    font-size: var(--font-size-base);
    background-color: var(--surface-color);
  }
  
  .filter-group input[type="checkbox"] {
    width: auto;
    margin: 0;
  }
  
  .filter-group small {
    margin-top: var(--spacing-xs);
    font-size: 0.75rem;
    color: var(--text-muted-color);
  }
  
  .resume-match-message {
    margin-top: var(--spacing-md);
    padding: var(--spacing-sm);
    background-color: var(--surface-secondary-color, #f3f4f6);
    border-radius: var(--border-radius);
    font-size: 0.875rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .resume-match-message p {
    margin: 0;
    color: var(--text-muted-color);
  }
  
  .resume-link {
    color: var(--primary-color);
    text-decoration: none;
    font-weight: 500;
    padding: var(--spacing-xs) var(--spacing-sm);
    border: 1px solid var(--primary-color);
    border-radius: var(--border-radius);
  }
  
  .resume-link:hover {
    background-color: var(--primary-color-light, #e0f2fe);
  }
  
  .reset-btn {
    padding: var(--spacing-sm);
    background-color: var(--background-color);
    color: var(--text-color);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    cursor: pointer;
    font-size: 0.875rem;
  }
  
  .reset-btn:hover {
    background-color: var(--background-hover-color, #f9fafb);
  }
  
  /* Results Styles */
  .results-info {
    margin-bottom: var(--spacing-md);
    color: var(--text-muted-color);
    font-size: 0.875rem;
  }
  
  .job-listings {
    display: grid;
    gap: var(--spacing-lg);
  }
  
  .job-card {
    padding: var(--spacing-lg);
    background-color: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    transition: box-shadow 0.2s, transform 0.2s;
  }
  
  .job-card:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05);
    transform: translateY(-2px);
  }
  
  .job-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: var(--spacing-sm);
  }
  
  .job-title {
    margin: 0;
    font-size: 1.25rem;
    line-height: 1.3;
    color: var(--primary-color);
  }
  
  .job-timeago {
    font-size: 0.75rem;
    color: var(--text-light-color);
    white-space: nowrap;
    margin-left: var(--spacing-sm);
  }
  
  .job-company {
    margin-bottom: var(--spacing-sm);
  }
  
  .company-name {
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
  
  .job-details {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-md);
    margin: var(--spacing-sm) 0;
  }
  
  .job-type {
    display: inline-block;
    background-color: var(--primary-color-light, #e0f2fe);
    color: var(--primary-color-dark, #1e40af);
    font-size: 0.75rem;
    font-weight: 500;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: 9999px;
  }
  
  .job-salary {
    display: inline-block;
    background-color: var(--success-bg-color, #dcfce7);
    color: var(--success-text-color, #166534);
    font-size: 0.75rem;
    font-weight: 500;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: 9999px;
  }
  
  /* Match percentage badge */
  .match-percentage {
    display: inline-flex;
    align-items: center;
    font-size: 0.75rem;
    font-weight: 600;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: 9999px;
    background-color: #e5e7eb; /* Default background */
    color: #4b5563; /* Default text color */
  }
  
  .match-percentage.high-match {
    background-color: #10b981; /* Green */
    color: white;
  }
  
  .match-percentage.medium-match {
    background-color: #f59e0b; /* Amber */
    color: white;
  }
  
  .match-percentage.low-match {
    background-color: #ef4444; /* Red */
    color: white;
  }
  
  .match-percentage::before {
    content: "📊";
    margin-right: 0.25rem;
  }
  
  .job-skills {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-xs);
    margin: var(--spacing-sm) 0;
  }
  
  .skill-tag {
    display: inline-block;
    background-color: var(--surface-secondary-color, #f3f4f6);
    color: var(--text-color);
    font-size: 0.75rem;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--border-radius);
  }
  
  .job-description {
    margin: var(--spacing-md) 0;
    color: var(--text-muted-color);
    font-size: 0.875rem;
    line-height: 1.5;
  }
  
  .job-description p {
    margin: 0;
  }
  
  .job-actions {
    display: flex;
    gap: var(--spacing-md);
    margin-top: var(--spacing-md);
  }
  
  .view-btn,
  .apply-btn {
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--border-radius);
    cursor: pointer;
    font-weight: 500;
    font-size: 0.875rem;
  }
  
  .view-btn {
    background-color: var(--background-color);
    color: var(--primary-color);
    border: 1px solid var(--primary-color);
  }
  
  .view-btn:hover {
    background-color: var(--primary-color-light, #e0f2fe);
  }
  
  .apply-btn {
    background-color: var(--primary-color);
    color: var(--primary-contrast-color);
    border: none;
    position: relative;
  }
  
  .apply-btn:hover {
    background-color: var(--primary-color-dark);
  }
  
  .apply-btn:hover::after {
    content: "Uses resume from your profile";
    position: absolute;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    background-color: var(--text-color);
    color: white;
    padding: var(--spacing-xs) var(--spacing-sm);
    border-radius: var(--border-radius);
    font-size: 0.75rem;
    white-space: nowrap;
    z-index: 10;
    margin-bottom: var(--spacing-xs);
  }
  
  /* Loading, Error, and Empty States */
  .loading-state,
  .error-state,
  .empty-state {
    text-align: center;
    padding: var(--spacing-xl);
    background-color: var(--surface-secondary-color, #f3f4f6);
    border-radius: var(--border-radius);
    margin-top: var(--spacing-lg);
  }
  
  .empty-state h3 {
    margin-top: 0;
    color: var(--text-color);
  }
  
  .empty-state p {
    color: var(--text-muted-color);
  }
  
  .message.error {
    color: var(--error-text-color, #b91c1c);
  }
  
  /* Responsive Styles */
  @media (max-width: 768px) {
    .filters {
      grid-template-columns: 1fr;
    }
    
    .job-header {
      flex-direction: column;
    }
    
    .job-timeago {
      margin-left: 0;
      margin-top: var(--spacing-xs);
    }
    
    .job-actions {
      flex-direction: column;
    }
    
    .resume-match-message {
      flex-direction: column;
      gap: var(--spacing-sm);
      text-align: center;
    }
  }
</style> 