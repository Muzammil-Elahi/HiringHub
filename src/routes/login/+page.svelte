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
        const errorMessage = result.error.message || 'Login failed';
        
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

<div class="container auth-page">
  <div class="auth-card">
    <h2>Log in to HiringHub</h2>
    
    {#if error}
      <div class="error-message">
        <p><span class="error-icon">⚠️</span> {error}</p>
      </div>
    {/if}
    
    <form on:submit|preventDefault={handleLogin}>
      <div class="form-group {emailError ? 'has-error' : ''}">
        <label for="email">Email</label>
        <input
          id="email"
          type="email"
          placeholder="your@email.com"
          bind:value={email}
          on:focus={() => handleFocus('email')}
          class:error-input={emailError}
          disabled={loading}
          required
        />
        {#if emailError}
          <div class="field-error">
            <p>{emailError}</p>
          </div>
        {/if}
      </div>
      
      <div class="form-group {passwordError ? 'has-error' : ''}">
        <label for="password">Password</label>
        <input
          id="password"
          type="password"
          placeholder="Your password"
          bind:value={password}
          on:focus={() => handleFocus('password')}
          class:error-input={passwordError}
          disabled={loading}
          required
        />
        {#if passwordError}
          <div class="field-error">
            <p>{passwordError}</p>
          </div>
        {/if}
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
  }
  
  .form-group input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.2);
  }
  
  .form-group input.error-input {
    border-color: var(--error-text-color);
    background-color: rgba(var(--error-bg-color), 0.05);
  }
  
  .form-group input.error-input:focus {
    box-shadow: 0 0 0 2px rgba(var(--error-text-color), 0.2);
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