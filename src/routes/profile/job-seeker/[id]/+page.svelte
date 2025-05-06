<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';
  import userStore from '$lib/stores/userStore';

  export let data;
  const { jobSeekerProfile, profileSkills } = data;

  // Helper function to format dates
  function formatDate(dateString: string | null) {
    if (!dateString) return '';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
</script>

<div class="container profile-view-page">
  <div class="page-header">
    <a href="javascript:history.back()" class="btn-secondary back-btn">← Back</a>
    <h2>Job Seeker Profile</h2>
  </div>

  {#if !jobSeekerProfile}
    <p class="message error">Profile not found or you don't have permission to view it.</p>
  {:else}
    <div class="profile-card">
      <div class="profile-header">
        <div class="avatar-container">
          {#if jobSeekerProfile.avatar_url}
            <img src={jobSeekerProfile.avatar_url} alt="Profile" class="avatar" />
          {:else}
            <div class="avatar-placeholder">{jobSeekerProfile.full_name?.charAt(0) || 'U'}</div>
          {/if}
        </div>
        <div class="profile-basics">
          <h2>{jobSeekerProfile.full_name || 'Job Seeker'}</h2>
          {#if jobSeekerProfile.headline}
            <p class="headline">{jobSeekerProfile.headline}</p>
          {/if}
          {#if jobSeekerProfile.location}
            <p class="location"><i class="location-icon">📍</i> {jobSeekerProfile.location}</p>
          {/if}
          <p class="member-since">Member since: {formatDate(jobSeekerProfile.created_at)}</p>
          
          <!-- Add contact button for hiring managers -->
          {#if $userStore.profile?.account_type === 'hiring_manager'}
            <a href="/messages/new" class="contact-button">
              <i class="message-icon">✉️</i> Contact Candidate
            </a>
          {/if}
        </div>
      </div>

      <div class="profile-section">
        <h3>About</h3>
        {#if jobSeekerProfile.bio && jobSeekerProfile.bio.trim() !== ''}
          <p class="bio">{jobSeekerProfile.bio}</p>
        {:else}
          <p class="bio empty-bio">This user hasn't added a bio yet.</p>
        {/if}
      </div>

      {#if profileSkills && profileSkills.length > 0}
        <div class="profile-section">
          <h3>Skills</h3>
          <div class="skills-container">
            {#each profileSkills as skill}
              <div class="skill-badge">
                <span class="skill-name">{skill.skill_name}</span>
                {#if skill.proficiency}
                  <span class="proficiency-indicator" data-level={skill.proficiency}>
                    {#if skill.proficiency === 1}
                      Beginner
                    {:else if skill.proficiency === 2}
                      Intermediate
                    {:else if skill.proficiency === 3}
                      Expert
                    {/if}
                  </span>
                {/if}
              </div>
            {/each}
          </div>
        </div>
      {/if}

      <div class="profile-section">
        <h3>Resume</h3>
        {#if jobSeekerProfile.resume_url}
          <a href={jobSeekerProfile.resume_url} target="_blank" class="btn-primary resume-btn">
            View Resume
          </a>
          <p class="resume-name">{jobSeekerProfile.resume_filename || 'resume.pdf'}</p>
        {:else}
          <p>No resume uploaded yet.</p>
        {/if}
      </div>

      {#if jobSeekerProfile.linkedin_url}
        <div class="profile-section">
          <h3>Professional Links</h3>
          <a href={jobSeekerProfile.linkedin_url} target="_blank" class="professional-link">
            LinkedIn Profile
          </a>
        </div>
      {/if}
    </div>
  {/if}
</div>

<style>
  .profile-view-page {
    max-width: 800px;
    margin: var(--spacing-lg) auto;
  }
  
  .page-header {
    display: flex;
    align-items: center;
    margin-bottom: var(--spacing-lg);
    gap: var(--spacing-md);
  }
  
  .back-btn {
    font-size: 0.875rem;
  }
  
  .page-header h2 {
    margin: 0;
  }
  
  .profile-card {
    background-color: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-lg);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }
  
  .profile-header {
    display: flex;
    gap: var(--spacing-lg);
    margin-bottom: var(--spacing-lg);
    padding-bottom: var(--spacing-lg);
    border-bottom: 1px solid var(--border-color);
  }
  
  .avatar-container {
    flex-shrink: 0;
  }
  
  .avatar, .avatar-placeholder {
    width: 100px;
    height: 100px;
    border-radius: 50%;
    overflow: hidden;
  }
  
  .avatar-placeholder {
    background-color: var(--primary-color);
    color: var(--primary-contrast-color);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 2.5rem;
    font-weight: bold;
  }
  
  .profile-basics {
    flex-grow: 1;
  }
  
  .profile-basics h2 {
    margin-top: 0;
    margin-bottom: var(--spacing-xs);
  }
  
  .headline {
    font-size: 1.1rem;
    color: var(--text-color);
    margin: var(--spacing-xs) 0;
  }
  
  .location {
    display: flex;
    align-items: center;
    color: var(--text-muted-color);
    margin: var(--spacing-xs) 0;
  }
  
  .location-icon {
    margin-right: 0.375rem;
    font-style: normal;
  }
  
  .member-since {
    font-size: 0.875rem;
    color: var(--text-light-color);
    margin: var(--spacing-xs) 0;
  }
  
  .profile-section {
    margin-bottom: var(--spacing-lg);
  }
  
  .profile-section h3 {
    margin-top: 0;
    margin-bottom: var(--spacing-md);
    font-size: 1.25rem;
    color: var(--text-color);
    border-bottom: 1px solid var(--border-color);
    padding-bottom: var(--spacing-xs);
  }
  
  .bio {
    white-space: pre-line;
    line-height: 1.6;
  }
  
  .empty-bio {
    color: var(--text-muted-color);
    font-style: italic;
  }
  
  .skills-container {
    display: flex;
    flex-wrap: wrap;
    gap: var(--spacing-sm);
  }
  
  .skill-badge {
    background-color: var(--surface-secondary-color, #f3f4f6);
    border-radius: var(--border-radius);
    padding: var(--spacing-xs) var(--spacing-sm);
    display: inline-flex;
    align-items: center;
    gap: var(--spacing-xs);
  }
  
  .proficiency-indicator {
    font-size: 0.75rem;
    padding: 0.125rem 0.375rem;
    border-radius: 9999px;
  }
  
  .proficiency-indicator[data-level="1"] {
    background-color: var(--info-bg-color, #e0f2fe);
    color: var(--info-text-color, #0369a1);
  }
  
  .proficiency-indicator[data-level="2"] {
    background-color: var(--primary-bg-color, #dbeafe);
    color: var(--primary-color, #2563eb);
  }
  
  .proficiency-indicator[data-level="3"] {
    background-color: var(--success-bg-color, #dcfce7);
    color: var(--success-text-color, #166534);
  }
  
  .resume-btn {
    display: inline-block;
    margin-bottom: var(--spacing-sm);
  }
  
  .resume-name {
    font-size: 0.875rem;
    color: var(--text-muted-color);
    margin: 0;
  }
  
  .professional-link {
    display: inline-flex;
    align-items: center;
    color: var(--primary-color);
    text-decoration: none;
  }
  
  .professional-link:hover {
    text-decoration: underline;
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
    color: var(--text-color);
    border: 1px solid var(--border-color);
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
    border-color: var(--text-muted-color);
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
  
  .contact-button {
    display: inline-flex;
    align-items: center;
    margin-top: var(--spacing-md);
    padding: var(--spacing-xs) var(--spacing-md);
    background-color: var(--primary-color);
    color: var(--primary-contrast-color);
    text-decoration: none;
    border-radius: var(--border-radius);
    font-size: 0.95rem;
    transition: background-color 0.2s;
  }
  
  .contact-button:hover {
    background-color: var(--primary-color-dark);
    text-decoration: none;
  }
  
  .message-icon {
    margin-right: var(--spacing-xs);
    font-style: normal;
  }
  
  @media (max-width: 768px) {
    .profile-header {
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    
    .avatar, .avatar-placeholder {
      margin-bottom: var(--spacing-md);
    }
  }
</style> 