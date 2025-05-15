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
  
  // Field-specific errors for better UX
  let emailError: string | null = null;
  let passwordError: string | null = null;
  
  // Check if already logged in
  onMount(() => {
    if ($userStore.loggedIn) {
      // Redirect to profile page based on account type
      redirectToProfile();
    }
    
    // Reset auth store loading to ensure errors are visible
    authStore.setLoading(false);
  });
  
  // Validate individual fields
  function validateEmail() {
    if (!email) {
      emailError = 'Email is required';
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      emailError = 'Please enter a valid email address';
      return false;
    }
    
    emailError = null;
    return true;
  }
  
  function validatePassword() {
    if (!password) {
      passwordError = 'Password is required';
      return false;
    }
    
    passwordError = null;
    return true;
  }
  
  // Focus handler to clear errors when user starts typing
  function handleFocus(field: 'email' | 'password') {
    if (field === 'email') emailError = null;
    if (field === 'password') passwordError = null;
    error = null; // Clear general error when user starts interacting
  }
  
  async function handleLogin() {
    // Reset errors first
    error = null;
    emailError = null;
    passwordError = null;
    
    // Validate all fields
    const isEmailValid = validateEmail();
    const isPasswordValid = validatePassword();
    
    if (!isEmailValid || !isPasswordValid) {
      return; // Stop if validation fails
    }
    
    loading = true;
    
    try {
      // Use the authStore login method
      const result = await authStore.login(email, password);
      
      if (!result.success) {
        // Format error messages in a user-friendly way
        const errorMessage = result.error instanceof Error 
          ? result.error.message 
          : typeof result.error === 'object' && result.error && 'message' in result.error
            ? (result.error as { message: string }).message
            : 'Login failed';
        
        if (errorMessage.toLowerCase().includes('invalid login')) {
          error = 'The email or password you entered is incorrect';
        } else if (errorMessage.toLowerCase().includes('email')) {
          emailError = errorMessage;
        } else if (errorMessage.toLowerCase().includes('password')) {
          passwordError = errorMessage;
        } else {
          error = errorMessage;
        }
        
        // Manually set loading to false so users can see errors
        loading = false;
        authStore.setLoading(false);
        throw new Error(errorMessage);
      }
      
      // Success - just keep loading state active
      // Redirect will be handled by the layout component
      console.log('Login successful, waiting for redirect...');
      
    } catch (err: any) {
      console.error('Login error:', err);
      if (!error) {
        error = err.message || 'An error occurred during login. Please try again.';
      }
      loading = false;
      authStore.setLoading(false);
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

<svelte:head>
  <title>Log In - HiringHub</title>
  <meta name="description" content="Log in to your HiringHub account to access job matches and opportunities.">
</svelte:head>

<div class="container auth-page">
  <div class="auth-card" role="region" aria-labelledby="login-heading">
    <h1 id="login-heading">Log in to HiringHub</h1>
    
    {#if error}
      <div class="error-message" role="alert" aria-live="assertive">
        <p><span class="error-icon" aria-hidden="true">⚠️</span> {error}</p>
      </div>
    {/if}
    
    <form on:submit|preventDefault={handleLogin} novalidate>
      <div class="form-group {emailError ? 'has-error' : ''}">
        <label for="email" id="email-label">Email</label>
        <input
          id="email"
          type="email"
          placeholder="your@email.com"
          bind:value={email}
          on:focus={() => handleFocus('email')}
          on:blur={validateEmail}
          class:error-input={emailError}
          disabled={loading}
          aria-required="true"
          aria-invalid={!!emailError}
          aria-describedby={emailError ? "email-error" : undefined}
          required
        />
        {#if emailError}
          <div class="field-error" id="email-error" role="alert">
            <p>{emailError}</p>
          </div>
        {/if}
      </div>
      
      <div class="form-group {passwordError ? 'has-error' : ''}">
        <label for="password" id="password-label">Password</label>
        <input
          id="password"
          type="password"
          placeholder="Your password"
          bind:value={password}
          on:focus={() => handleFocus('password')}
          on:blur={validatePassword}
          class:error-input={passwordError}
          disabled={loading}
          aria-required="true"
          aria-invalid={!!passwordError}
          aria-describedby={passwordError ? "password-error" : undefined}
          required
        />
        {#if passwordError}
          <div class="field-error" id="password-error" role="alert">
            <p>{passwordError}</p>
          </div>
        {/if}
      </div>
      
      <div class="form-actions">
        <button 
          type="submit" 
          class="btn-primary" 
          disabled={loading}
          aria-busy={loading}
        >
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
  
  h1 {
    text-align: center;
    margin-bottom: var(--spacing-lg);
    color: var(--primary-color);
    font-size: 1.75rem;
  }
  
  .form-group {
    margin-bottom: var(--spacing-md);
    position: relative; /* For positioning error messages */
  }
  
  .form-group.has-error label {
    color: var(--error-text-color);
  }
  
  .form-group label {
    display: block;
    margin-bottom: var(--spacing-xs);
    font-weight: 500;
    transition: color 0.2s ease;
  }
  
  .form-group input {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    font-size: var(--font-size-base);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
    min-height: var(--min-target-size);
  }
  
  .form-group input:focus {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
    border-color: var(--primary-color);
    box-shadow: none;
  }
  
  .form-group input.error-input {
    border-color: var(--error-text-color);
    background-color: #fff8f8;
  }
  
  .form-group input.error-input:focus {
    outline-color: var(--error-text-color);
  }
  
  .field-error {
    color: var(--error-text-color);
    font-size: 0.85rem;
    margin-top: 0.25rem;
    animation: slideIn 0.2s ease;
  }
  
  .field-error p {
    margin: 0;
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
    min-height: var(--min-target-size);
  }
  
  .btn-primary:hover:not(:disabled) {
    background-color: var(--primary-color-dark);
  }
  
  .btn-primary:focus {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
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
    padding: var(--spacing-xs);
    display: inline-block;
  }
  
  .auth-footer a:hover {
    text-decoration: underline;
  }
  
  .auth-footer a:focus {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
    text-decoration: underline;
  }
  
  .error-message {
    background-color: var(--error-bg-color);
    color: var(--error-text-color);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--border-radius);
    margin-bottom: var(--spacing-md);
    border-left: 4px solid var(--error-text-color);
    animation: shake 0.5s ease;
  }
  
  .error-message p {
    margin: 0;
    display: flex;
    align-items: center;
  }
  
  .error-icon {
    margin-right: var(--spacing-xs);
  }
  
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    10%, 30%, 50%, 70%, 90% { transform: translateX(-5px); }
    20%, 40%, 60%, 80% { transform: translateX(5px); }
  }
  
  @keyframes slideIn {
    from { opacity: 0; transform: translateY(-5px); }
    to { opacity: 1; transform: translateY(0); }
  }
</style> 