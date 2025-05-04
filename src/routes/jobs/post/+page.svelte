<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';
  import userStore from '$lib/stores/userStore';

  // Form state
  let title = '';
  let description = '';
  let company_name = '';
  let location = '';
  let job_type = '';
  let salary_min: number | null = null;
  let salary_max: number | null = null;
  let salary_currency = 'USD';
  let skills: string[] = [''];
  let isActive = true;
  
  // UI state
  let loading = false;
  let message = '';
  let messageType: 'success' | 'error' = 'error';
  let skillsInputError = '';

  // Manage skills input
  function addSkill() {
    skills = [...skills, ''];
    skillsInputError = '';
  }
  
  function removeSkill(index: number) {
    if (skills.length > 1) {
      skills = skills.filter((_, i) => i !== index);
    } else {
      // If it's the last one, just clear it
      skills = [''];
    }
  }
  
  function updateSkill(index: number, value: string) {
    const newSkills = [...skills];
    newSkills[index] = value;
    skills = newSkills;
    
    // Clear error when user starts typing
    if (skillsInputError) skillsInputError = '';
  }
  
  // Validate job post form
  function validateForm(): boolean {
    // Basic validations
    if (!title.trim()) {
      message = 'Job title is required';
      messageType = 'error';
      return false;
    }
    
    if (!description.trim()) {
      message = 'Job description is required';
      messageType = 'error';
      return false;
    }
    
    if (!company_name.trim()) {
      message = 'Company name is required';
      messageType = 'error';
      return false;
    }
    
    if (!location.trim()) {
      message = 'Job location is required';
      messageType = 'error';
      return false;
    }
    
    if (!job_type.trim()) {
      message = 'Job type is required';
      messageType = 'error';
      return false;
    }
    
    // Validate skills
    const validSkills = skills.filter(skill => skill.trim() !== '');
    if (validSkills.length === 0) {
      skillsInputError = 'At least one skill is required';
      message = 'Please add at least one required skill';
      messageType = 'error';
      return false;
    }
    
    // Salary validation
    if (salary_min !== null && salary_max !== null && salary_min > salary_max) {
      message = 'Minimum salary cannot be greater than maximum salary';
      messageType = 'error';
      return false;
    }
    
    return true;
  }
  
  // Submit job post to database
  async function handleSubmit() {
    if (!validateForm()) return;
    
    if (!$userStore.loggedIn || $userStore.profile?.account_type !== 'hiring_manager') {
      message = 'You must be logged in as a hiring manager to post jobs';
      messageType = 'error';
      return;
    }
    
    loading = true;
    message = '';
    
    try {
      const filteredSkills = skills.filter(skill => skill.trim() !== '');
      
      // Create the job in the jobs table
      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .insert({
          title,
          description,
          company_name,
          location,
          job_type,
          salary_min,
          salary_max,
          salary_currency,
          is_active: isActive,
          hiring_manager_id: $userStore.user?.id
        })
        .select()
        .single();
      
      if (jobError) throw jobError;
      
      // Insert job skills with correct skill_id and skill_name
      if (filteredSkills.length > 0) {
        const jobSkillsToInsert = [];
        for (const skillName of filteredSkills) {
          // 1. Check if skill exists
          let { data: skillRow, error: skillLookupError } = await supabase
            .from('skills')
            .select('id')
            .eq('name', skillName)
            .maybeSingle();
          if (skillLookupError) throw skillLookupError;
          let skillId;
          if (!skillRow) {
            // 2. Insert new skill
            const { data: newSkill, error: skillInsertError } = await supabase
              .from('skills')
              .insert({ name: skillName })
              .select()
              .single();
            if (skillInsertError) throw skillInsertError;
            skillId = newSkill.id;
          } else {
            skillId = skillRow.id;
          }
          // 3. Add to job_skills (with skill_name)
          jobSkillsToInsert.push({
            job_id: jobData.id,
            skill_id: skillId,
            skill_name: skillName,
            is_required: true
          });
        }
        if (jobSkillsToInsert.length > 0) {
          const { error: skillsError } = await supabase
            .from('job_skills')
            .insert(jobSkillsToInsert);
          if (skillsError) {
            console.error('Error adding job skills:', skillsError);
            // Continue despite error, the job was created
          }
        }
      }
      
      // Success
      message = 'Job posted successfully!';
      messageType = 'success';
      
      // Reset form after successful submission
      setTimeout(() => {
        goto('/profile/hiring-manager');
      }, 2000);
      
    } catch (error: any) {
      console.error('Error posting job:', error);
      message = `Error posting job: ${error.message}`;
      messageType = 'error';
    } finally {
      loading = false;
    }
  }
</script>

<div class="container job-post-page">
  <h2>Post a New Job</h2>
  
  {#if !$userStore.loggedIn}
    <p>You must be <a href="/login">logged in</a> to post jobs.</p>
  {:else if $userStore.profile?.account_type !== 'hiring_manager'}
    <p class="message error">Only hiring managers can post jobs. Please switch to a hiring manager account.</p>
  {:else}
    {#if message}
      <p class="message {messageType}">{message}</p>
    {/if}
    
    <form on:submit|preventDefault={handleSubmit} class="job-form">
      <div class="form-group">
        <label for="job-title">Job Title*</label>
        <input 
          id="job-title" 
          type="text" 
          bind:value={title} 
          placeholder="e.g., Senior Software Engineer"
          required
          disabled={loading}
        />
      </div>
      
      <div class="form-group">
        <label for="job-company">Company Name*</label>
        <input 
          id="job-company" 
          type="text" 
          bind:value={company_name} 
          placeholder="Your Company" 
          required
          disabled={loading}
        />
        <small>Enter the company name for this job posting</small>
      </div>
      
      <div class="form-group">
        <label for="job-location">Job Location*</label>
        <input 
          id="job-location" 
          type="text" 
          bind:value={location} 
          placeholder="e.g., New York, NY or Remote" 
          required
          disabled={loading}
        />
      </div>
      
      <div class="form-group">
        <label for="job-type">Job Type*</label>
        <select id="job-type" bind:value={job_type} required disabled={loading}>
          <option value="">Select Job Type</option>
          <option value="Full-time">Full-time</option>
          <option value="Part-time">Part-time</option>
          <option value="Contract">Contract</option>
          <option value="Temporary">Temporary</option>
          <option value="Internship">Internship</option>
          <option value="Remote">Remote</option>
        </select>
      </div>
      
      <div class="form-row">
        <div class="form-group">
          <label for="salary-min">Minimum Salary</label>
          <input 
            id="salary-min" 
            type="number" 
            bind:value={salary_min} 
            placeholder="e.g., 50000"
            min="0"
            step="1000" 
            disabled={loading}
          />
        </div>
        
        <div class="form-group">
          <label for="salary-max">Maximum Salary</label>
          <input 
            id="salary-max" 
            type="number" 
            bind:value={salary_max} 
            placeholder="e.g., 80000"
            min="0"
            step="1000" 
            disabled={loading}
          />
        </div>
        
        <div class="form-group currency-select">
          <label for="salary-currency">Currency</label>
          <select id="salary-currency" bind:value={salary_currency} disabled={loading}>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
            <option value="GBP">GBP</option>
            <option value="CAD">CAD</option>
            <option value="AUD">AUD</option>
            <option value="JPY">JPY</option>
          </select>
        </div>
      </div>
      
      <div class="form-group">
        <label>Required Skills {#if skillsInputError}<span class="error-text">({skillsInputError})</span>{/if}</label>
        {#each skills as skill, i}
          <div class="skill-input-row">
            <input
              type="text"
              placeholder="e.g., JavaScript"
              bind:value={skill}
              on:input={() => updateSkill(i, skill)}
              disabled={loading}
            />
            <button 
              type="button" 
              class="btn-icon remove-skill" 
              on:click={() => removeSkill(i)}
              disabled={loading || skills.length === 1}
              aria-label="Remove skill"
            >
              ✕
            </button>
          </div>
        {/each}
        <button 
          type="button" 
          class="btn-secondary add-skill" 
          on:click={addSkill}
          disabled={loading}
        >
          + Add Another Skill
        </button>
      </div>
      
      <div class="form-group">
        <label for="job-description">Job Description*</label>
        <textarea 
          id="job-description" 
          bind:value={description} 
          rows="8" 
          placeholder="Provide a detailed description of the job responsibilities, requirements, and company information..."
          required
          disabled={loading}
        ></textarea>
      </div>
      
      <div class="form-group checkbox-group">
        <label class="checkbox-label">
          <input 
            type="checkbox" 
            bind:checked={isActive} 
            disabled={loading}
          />
          <span>Make this job listing active immediately</span>
        </label>
        <small>Uncheck if you want to save as draft and activate later.</small>
      </div>
      
      <div class="form-actions">
        <button type="button" class="btn-secondary" on:click={() => goto('/profile/hiring-manager')} disabled={loading}>
          Cancel
        </button>
        <button type="submit" class="btn-primary" disabled={loading}>
          {loading ? 'Posting Job...' : 'Post Job'}
        </button>
      </div>
    </form>
  {/if}
</div>

<style>
  .job-post-page {
    max-width: 800px;
    margin: var(--spacing-lg) auto;
  }
  
  .job-form {
    margin-top: var(--spacing-lg);
    padding: var(--spacing-lg);
    background-color: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
  }
  
  .form-group {
    margin-bottom: var(--spacing-lg);
  }
  
  .form-row {
    display: grid;
    grid-template-columns: 1fr 1fr 0.8fr;
    gap: var(--spacing-md);
  }
  
  @media (max-width: 768px) {
    .form-row {
      grid-template-columns: 1fr;
    }
  }
  
  .form-group label {
    display: block;
    margin-bottom: var(--spacing-xs);
    font-weight: 500;
    color: var(--text-color);
  }
  
  .form-group input,
  .form-group select,
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
  .form-group select:focus,
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
  
  .skill-input-row {
    display: flex;
    align-items: center;
    gap: var(--spacing-sm);
    margin-bottom: var(--spacing-xs);
  }
  
  .btn-icon {
    padding: var(--spacing-xs);
    width: 32px;
    height: 32px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background-color: var(--error-bg-color, #fee2e2);
    color: var(--error-text-color, #b91c1c);
    border: 1px solid var(--error-border-color, #fca5a5);
    cursor: pointer;
    font-size: 0.875rem;
    transition: background-color 0.2s;
  }
  
  .btn-icon:hover:not(:disabled) {
    background-color: var(--error-border-color, #fca5a5);
  }
  
  .btn-icon:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
  
  .add-skill {
    margin-top: var(--spacing-xs);
    padding: var(--spacing-xs) var(--spacing-sm);
    font-size: 0.875rem;
    width: auto;
    display: inline-flex;
  }
  
  .checkbox-group {
    display: flex;
    flex-direction: column;
  }
  
  .checkbox-label {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    cursor: pointer;
  }
  
  .checkbox-label input[type="checkbox"] {
    width: auto;
    margin: 0;
  }
  
  .error-text {
    color: var(--error-text-color, #b91c1c);
    font-weight: normal;
    font-size: 0.875rem;
  }
  
  .form-actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--spacing-md);
    margin-top: var(--spacing-xl);
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
</style> 

<!-- --- SCHEMA MIGRATION SQL ---
ALTER TABLE job_skills ADD COLUMN skill_name text;
UPDATE job_skills SET skill_name = skills.name FROM skills WHERE job_skills.skill_id = skills.id; --> 