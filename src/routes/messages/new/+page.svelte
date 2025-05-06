<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';
  import userStore from '$lib/stores/userStore';
  
  // Data state
  let jobs: any[] = [];
  let jobId: string = '';
  let selectedJob = null;
  let jobSeekers: any[] = [];
  let selectedJobSeeker: string = '';
  let initialMessage: string = '';
  
  // UI state
  let loading = true;
  let creating = false;
  let error = '';
  let message = '';
  
  // Debug
  let debugLogs: string[] = [];
  
  // Function to add debug logs
  function debug(message: string) {
    const timestamp = new Date().toISOString().substr(11, 12);
    debugLogs = [...debugLogs, `[${timestamp}] ${message}`];
    console.log(`[DEBUG] ${message}`);
  }
  
  onMount(async () => {
    debug('Component mounted');
    
    if (!$userStore.loggedIn) {
      debug('User not logged in, redirecting to login page');
      goto('/login');
      return;
    }
    
    if ($userStore.profile?.account_type !== 'hiring_manager') {
      debug('User is not a hiring manager, redirecting');
      goto('/messages');
      return;
    }
    
    await loadJobs();
  });
  
  // Load jobs posted by the hiring manager
  async function loadJobs() {
    debug('Loading jobs');
    loading = true;
    error = '';
    
    try {
      const { data, error: jobsError } = await supabase
        .from('jobs')
        .select('*')
        .eq('hiring_manager_id', $userStore.user?.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (jobsError) throw jobsError;
      
      jobs = data || [];
      debug(`Loaded ${jobs.length} jobs`);
      
      // If jobs are available, select the first one by default
      if (jobs.length > 0) {
        jobId = jobs[0].id;
        selectedJob = jobs[0];
        await loadJobSeekers(jobId);
      }
      
    } catch (err: any) {
      error = `Error loading jobs: ${err.message}`;
      debug(`Error: ${error}`);
    } finally {
      loading = false;
    }
  }
  
  // Load job seekers who have applied to the selected job
  async function loadJobSeekers(id: string) {
    debug(`Loading job seekers for job ${id}`);
    
    try {
      // Find the selected job
      selectedJob = jobs.find(job => job.id === id);
      
      // Get job seekers who have applied to this job
      const { data: applications, error: appError } = await supabase
        .from('applications')
        .select(`
          *,
          job_seeker:job_seeker_id (user_id, full_name, headline, avatar_url)
        `)
        .eq('job_id', id);
      
      if (appError) throw appError;
      
      // Transform to a usable format
      jobSeekers = applications
        .filter(app => app.job_seeker) // Remove any invalid entries
        .map(app => ({
          id: app.job_seeker.user_id,
          name: app.job_seeker.full_name,
          headline: app.job_seeker.headline,
          avatar: app.job_seeker.avatar_url,
          application_date: app.application_date,
          status: app.status
        }));
      
      debug(`Loaded ${jobSeekers.length} job seekers`);
      
      // Clear previous selection
      selectedJobSeeker = '';
      
    } catch (err: any) {
      error = `Error loading applicants: ${err.message}`;
      debug(`Error: ${error}`);
    }
  }
  
  // Handle job change
  async function handleJobChange() {
    await loadJobSeekers(jobId);
  }
  
  // Start a new conversation
  async function startConversation() {
    if (!selectedJobSeeker || !jobId || !initialMessage.trim()) {
      error = 'Please select a job seeker and write an initial message.';
      return;
    }
    
    debug(`Starting conversation with job seeker ${selectedJobSeeker} for job ${jobId}`);
    creating = true;
    error = '';
    message = '';
    
    try {
      // Check if chat already exists
      const { data: existingChat, error: chatCheckError } = await supabase
        .from('chats')
        .select('id')
        .eq('job_id', jobId)
        .eq('hiring_manager_id', $userStore.user?.id)
        .eq('job_seeker_id', selectedJobSeeker)
        .maybeSingle();
      
      if (chatCheckError) throw chatCheckError;
      
      let chatId;
      
      if (existingChat) {
        // Chat already exists
        chatId = existingChat.id;
        debug(`Chat already exists with ID: ${chatId}`);
        message = 'Existing conversation found. Redirecting...';
      } else {
        // Create a new chat
        const { data: newChat, error: createChatError } = await supabase
          .from('chats')
          .insert({
            job_id: jobId,
            hiring_manager_id: $userStore.user?.id,
            job_seeker_id: selectedJobSeeker,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            last_message_at: new Date().toISOString()
          })
          .select()
          .single();
        
        if (createChatError) throw createChatError;
        
        chatId = newChat.id;
        debug(`Created new chat with ID: ${chatId}`);
        
        // Send the initial message
        const { error: messageError } = await supabase
          .from('messages')
          .insert({
            chat_id: chatId,
            sender_id: $userStore.user?.id,
            content: initialMessage,
            created_at: new Date().toISOString(),
            delivered_at: new Date().toISOString(),
            read_at: null
          });
        
        if (messageError) throw messageError;
        
        debug(`Sent initial message to chat ${chatId}`);
        message = 'Conversation started successfully. Redirecting...';
      }
      
      // Redirect to the chat
      setTimeout(() => {
        goto(`/messages?id=${chatId}`);
      }, 1000);
      
    } catch (err: any) {
      error = `Error starting conversation: ${err.message}`;
      debug(`Error: ${error}`);
    } finally {
      creating = false;
    }
  }
</script>

<svelte:head>
  <title>Start a Conversation | HiringHub</title>
</svelte:head>

<div class="container">
  <div class="page-header">
    <h2>Start a New Conversation</h2>
    <a href="/messages" class="btn-secondary">
      Back to Messages
    </a>
  </div>
  
  {#if error}
    <div class="message error">
      {error}
    </div>
  {/if}
  
  {#if message}
    <div class="message success">
      {message}
    </div>
  {/if}
  
  <div class="new-chat-form">
    {#if loading}
      <div class="loading-state">Loading your jobs...</div>
    {:else if jobs.length === 0}
      <div class="empty-state">
        <p>You don't have any active job postings.</p>
        <a href="/jobs/post" class="btn-primary">Post a Job</a>
      </div>
    {:else}
      <div class="form-group">
        <label for="job-select">Select a Job</label>
        <select id="job-select" bind:value={jobId} on:change={handleJobChange} disabled={creating}>
          {#each jobs as job}
            <option value={job.id}>{job.title} at {job.company_name}</option>
          {/each}
        </select>
      </div>
      
      <div class="form-group">
        <label>Select a Job Seeker</label>
        {#if jobSeekers.length === 0}
          <div class="empty-applicants">
            <p>No applications for this job yet.</p>
          </div>
        {:else}
          <div class="job-seeker-list">
            {#each jobSeekers as seeker}
              <div class="job-seeker-item {selectedJobSeeker === seeker.id ? 'selected' : ''}" on:click={() => selectedJobSeeker = seeker.id}>
                <div class="seeker-avatar">
                  {#if seeker.avatar}
                    <img src={seeker.avatar} alt={seeker.name} />
                  {:else}
                    <div class="avatar-placeholder">{seeker.name.charAt(0)}</div>
                  {/if}
                </div>
                <div class="seeker-info">
                  <h4>{seeker.name}</h4>
                  {#if seeker.headline}
                    <p class="seeker-headline">{seeker.headline}</p>
                  {/if}
                  <div class="meta-info">
                    <span class="application-date">Applied: {new Date(seeker.application_date).toLocaleDateString()}</span>
                    <span class="application-status">{seeker.status}</span>
                  </div>
                </div>
                <div class="selection-indicator">
                  {#if selectedJobSeeker === seeker.id}
                    <span class="check-icon">✓</span>
                  {/if}
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
      
      <div class="form-group">
        <label for="initial-message">Initial Message</label>
        <textarea 
          id="initial-message" 
          bind:value={initialMessage} 
          placeholder="Write your message to the job seeker..."
          rows="4"
          disabled={creating || !selectedJobSeeker}
        ></textarea>
        <small>This will be sent as the first message in the conversation.</small>
      </div>
      
      <div class="form-actions">
        <button 
          class="btn-primary" 
          on:click={startConversation} 
          disabled={creating || !selectedJobSeeker || !initialMessage.trim()}
        >
          {creating ? 'Starting Conversation...' : 'Start Conversation'}
        </button>
      </div>
    {/if}
  </div>
  
  <!-- Debug logs (hidden in production) -->
  <div class="debug-logs">
    {#each debugLogs as log}
      <div class="debug-log">{log}</div>
    {/each}
  </div>
</div>

<style>
  .container {
    max-width: 800px;
    margin: var(--spacing-lg) auto;
  }
  
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-lg);
  }
  
  .page-header h2 {
    margin: 0;
  }
  
  .new-chat-form {
    background-color: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-lg);
  }
  
  .form-group {
    margin-bottom: var(--spacing-lg);
  }
  
  .form-group label {
    display: block;
    margin-bottom: var(--spacing-sm);
    font-weight: 500;
  }
  
  .form-group select,
  .form-group textarea {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    font-family: inherit;
    font-size: inherit;
  }
  
  .form-group select:focus,
  .form-group textarea:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.2);
  }
  
  .form-group textarea {
    resize: vertical;
    min-height: 100px;
  }
  
  .job-seeker-list {
    max-height: 300px;
    overflow-y: auto;
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
  }
  
  .job-seeker-item {
    display: flex;
    align-items: center;
    padding: var(--spacing-md);
    border-bottom: 1px solid var(--border-color);
    cursor: pointer;
    transition: background-color 0.2s;
  }
  
  .job-seeker-item:last-child {
    border-bottom: none;
  }
  
  .job-seeker-item:hover {
    background-color: rgba(0, 0, 0, 0.03);
  }
  
  .job-seeker-item.selected {
    background-color: rgba(var(--primary-color-rgb), 0.1);
  }
  
  .seeker-avatar {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    overflow: hidden;
    margin-right: var(--spacing-md);
    flex-shrink: 0;
  }
  
  .seeker-avatar img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  
  .avatar-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: var(--primary-color);
    color: white;
    font-weight: bold;
    font-size: 1.2rem;
  }
  
  .seeker-info {
    flex: 1;
    min-width: 0;
  }
  
  .seeker-info h4 {
    margin: 0 0 4px 0;
    font-size: 1rem;
  }
  
  .seeker-headline {
    margin: 0 0 8px 0;
    font-size: 0.875rem;
    color: var(--text-muted-color);
  }
  
  .meta-info {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-md);
    font-size: 0.75rem;
  }
  
  .application-date {
    color: var(--text-muted-color);
  }
  
  .application-status {
    font-weight: 500;
    color: var(--primary-color);
  }
  
  .selection-indicator {
    width: 24px;
    height: 24px;
    margin-left: var(--spacing-md);
  }
  
  .check-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background-color: var(--primary-color);
    color: white;
    font-weight: bold;
  }
  
  .form-actions {
    display: flex;
    justify-content: flex-end;
  }
  
  .btn-primary {
    padding: var(--spacing-sm) var(--spacing-lg);
    background-color: var(--primary-color);
    color: white;
    border: none;
    border-radius: var(--border-radius);
    cursor: pointer;
    font-weight: 500;
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
    text-decoration: none;
    display: inline-flex;
    align-items: center;
  }
  
  .btn-secondary:hover {
    background-color: var(--background-hover-color, #f9fafb);
  }
  
  .message {
    padding: var(--spacing-sm) var(--spacing-md);
    margin-bottom: var(--spacing-md);
    border-radius: var(--border-radius);
    text-align: center;
  }
  
  .message.error {
    background-color: var(--error-bg-color, #fee2e2);
    color: var(--error-text-color, #b91c1c);
    border: 1px solid var(--error-border-color, #fca5a5);
  }
  
  .message.success {
    background-color: var(--success-bg-color, #dcfce7);
    color: var(--success-text-color, #166534);
    border: 1px solid var(--success-border-color, #86efac);
  }
  
  .loading-state,
  .empty-state,
  .empty-applicants {
    padding: var(--spacing-lg);
    text-align: center;
    color: var(--text-muted-color);
  }
  
  .empty-state a {
    margin-top: var(--spacing-md);
    display: inline-block;
  }
  
  small {
    display: block;
    margin-top: var(--spacing-xs);
    color: var(--text-muted-color);
    font-size: var(--font-size-sm);
  }
  
  .debug-logs {
    display: none; /* Hidden by default */
    margin-top: var(--spacing-lg);
    padding: var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    background-color: #f8f9fa;
    font-family: monospace;
    font-size: 12px;
    max-height: 200px;
    overflow-y: auto;
  }
  
  .debug-log {
    padding: 2px 0;
    border-bottom: 1px solid #eee;
  }
</style> 