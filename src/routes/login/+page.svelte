<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import authStore from '$lib/stores/authStore';
  import userStore from '$lib/stores/userStore';
  import { supabase } from '$lib/supabaseClient';
  
  // Form data
  let email = '';
  let password = '';
  let loading = false;
  let error: string | null = null;
  
  // Check if already logged in
  onMount(() => {
    if ($userStore.loggedIn) {
      // Redirect to profile page based on account type
      redirectToProfile();
    }
  });
  
  async function handleLogin() {
    if (!email || !password) {
      error = 'Please enter both email and password';
      return;
    }
    
    error = null;
    loading = true;
    
    try {
      // Use the authStore login method
      const result = await authStore.login(email, password);
      
      if (!result.success) {
        throw new Error(result.error.message || 'Login failed');
      }
      
      // Success - just keep the loading state active
      // Redirect will be handled by the layout component
      console.log('Login successful, waiting for redirect...');
      
    } catch (err: any) {
      console.error('Login error:', err);
      error = err.message || 'An error occurred during login. Please try again.';
      loading = false;
    }
  }
  
  // Function to determine where to redirect based on profile type
  function redirectToProfile() {
    if ($userStore.profile?.account_type === 'job_seeker') {
      goto('/profile/job-seeker');
    } else if ($userStore.profile?.account_type === 'hiring_manager') {
      goto('/profile/hiring-manager');
    } else {
      goto('/profile');
    }
  }
</script>

<div class="container auth-page">
  <div class="auth-card">
    <h2>Log in to HiringHub</h2>
    
    {#if error}
      <div class="error-message">
        <p>{error}</p>
      </div>
    {/if}
    
    <form on:submit|preventDefault={handleLogin}>
      <div class="form-group">
        <label for="email">Email</label>
        <input
          id="email"
          type="email"
          placeholder="your@email.com"
          bind:value={email}
          disabled={loading}
          required
        />
      </div>
      
      <div class="form-group">
        <label for="password">Password</label>
        <input
          id="password"
          type="password"
          placeholder="Your password"
          bind:value={password}
          disabled={loading}
          required
        />
      </div>
      
      <div class="form-actions">
        <button type="submit" class="btn-primary" disabled={loading}>
          {loading ? 'Logging in...' : 'Log In'}
        </button>
      </div>
    </form>
    
    <div class="auth-footer">
      <p>Don't have an account? <a href="/register">Register</a></p>
      <p><a href="/reset-password">Forgot password?</a></p>
    </div>
  </div>
</div>

<style>
  .auth-page {
    max-width: 500px;
    margin: 2rem auto;
  }
  
  .auth-card {
    background-color: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    padding: var(--spacing-lg);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  }
  
  h2 {
    text-align: center;
    margin-bottom: var(--spacing-lg);
    color: var(--primary-color);
  }
  
  .form-group {
    margin-bottom: var(--spacing-md);
  }
  
  .form-group label {
    display: block;
    margin-bottom: var(--spacing-xs);
    font-weight: 500;
  }
  
  .form-group input {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    font-size: var(--font-size-base);
  }
  
  .form-group input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.2);
  }
  
  .form-actions {
    margin-top: var(--spacing-lg);
  }
  
  .btn-primary {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    background-color: var(--primary-color);
    color: var(--primary-contrast-color);
    border: none;
    border-radius: var(--border-radius);
    cursor: pointer;
    font-weight: 500;
    transition: background-color 0.3s;
  }
  
  .btn-primary:hover:not(:disabled) {
    background-color: var(--primary-color-dark);
  }
  
  .btn-primary:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }
  
  .auth-footer {
    margin-top: var(--spacing-lg);
    text-align: center;
    font-size: var(--font-size-sm);
  }
  
  .auth-footer p {
    margin-bottom: var(--spacing-xs);
  }
  
  .auth-footer a {
    color: var(--primary-color);
    text-decoration: none;
  }
  
  .auth-footer a:hover {
    text-decoration: underline;
  }
  
  .error-message {
    background-color: var(--error-bg-color);
    color: var(--error-text-color);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--border-radius);
    margin-bottom: var(--spacing-md);
  }
  
  .error-message p {
    margin: 0;
  }
</style> 