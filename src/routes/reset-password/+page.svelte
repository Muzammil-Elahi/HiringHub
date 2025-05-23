<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import authStore from '$lib/stores/authStore';
  import userStore from '$lib/stores/userStore';
  
  // Form data
  let email = '';
  let loading = false;
  let error: string | null = null;
  let success = false;
  
  // Field-specific errors for better UX
  let emailError: string | null = null;
  
  // Check if already logged in
  onMount(() => {
    if ($userStore.loggedIn) {
      redirectToProfile();
    }
    
    // Reset auth store loading to ensure errors are visible
    authStore.setLoading(false);
  });
  
  // Validate email
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
  
  // Focus handler to clear errors when user starts typing
  function handleFocus() {
    emailError = null;
    error = null;
    success = false;
  }
  
  async function handleResetRequest() {
    // Reset errors first
    error = null;
    emailError = null;
    success = false;
    
    // Validate email
    const isEmailValid = validateEmail();
    if (!isEmailValid) {
      return; // Stop if validation fails
    }
    
    loading = true;
    
    try {
      // Request password reset
      const result = await authStore.resetPassword(email);
      
      if (!result.success) {
        // Format error messages in a user-friendly way
        const errorMessage = result.error && typeof result.error === 'object' && 'message' in result.error 
          ? String(result.error.message) 
          : 'Password reset request failed';
        
        if (errorMessage.toLowerCase().includes('email')) {
          emailError = errorMessage;
        } else {
          error = errorMessage;
        }
      } else {
        // Success
        success = true;
        email = ''; // Clear the form
      }
    } catch (err: any) {
      console.error('Password reset error:', err);
      error = err.message || 'An error occurred. Please try again.';
    } finally {
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

<svelte:head>
  <title>Reset Password - HiringHub</title>
  <meta name="description" content="Reset your HiringHub account password securely.">
</svelte:head>

<div class="container auth-page">
  <div class="auth-card" role="region" aria-labelledby="reset-password-heading">
    <h1 id="reset-password-heading">Reset Password</h1>
    
    {#if error}
      <div class="error-message" role="alert" aria-live="assertive">
        <p><span class="error-icon" aria-hidden="true">⚠️</span> {error}</p>
      </div>
    {/if}
    
    {#if success}
      <div class="success-message" role="status" aria-live="polite">
        <p><span class="success-icon" aria-hidden="true">✓</span> Password reset link sent! Please check your email for instructions.</p>
      </div>
    {/if}
    
    <form on:submit|preventDefault={handleResetRequest} novalidate>
      <div class="form-group {emailError ? 'has-error' : ''}">
        <label for="email" id="email-label">Email</label>
        <input
          id="email"
          type="email"
          placeholder="your@email.com"
          bind:value={email}
          on:focus={handleFocus}
          on:blur={validateEmail}
          class:error-input={emailError}
          disabled={loading || success}
          aria-required="true"
          aria-invalid={!!emailError}
          aria-describedby={emailError ? "email-error" : "form-instructions"}
          required
        />
        {#if emailError}
          <div class="field-error" id="email-error" role="alert">
            <p>{emailError}</p>
          </div>
        {/if}
      </div>
      
      <div class="form-info" id="form-instructions">
        <p>Enter your email address and we'll send you a link to reset your password.</p>
      </div>
      
      <div class="form-actions">
        <button 
          type="submit" 
          class="btn-primary" 
          disabled={loading || success}
          aria-busy={loading}
        >
          {loading ? 'Sending...' : 'Send Reset Link'}
        </button>
      </div>
    </form>
    
    <div class="auth-footer">
      <p>Remember your password? <a href="/login">Log In</a></p>
      <p>Don't have an account? <a href="/register">Register</a></p>
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
  
  .form-info {
    margin-bottom: var(--spacing-md);
    padding: var(--spacing-sm);
    background-color: var(--info-bg-color, #e0f2fe);
    border-radius: var(--border-radius);
    font-size: 0.9rem;
    color: var(--info-text-color, #0369a1);
  }
  
  .form-info p {
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
    transition: background-color 0.2s;
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
  
  .success-message {
    background-color: var(--success-bg-color, #dcfce7);
    color: var(--success-text-color, #166534);
    padding: var(--spacing-sm) var(--spacing-md);
    border-radius: var(--border-radius);
    margin-bottom: var(--spacing-md);
    border-left: 4px solid var(--success-text-color, #166534);
  }
  
  .error-message p, .success-message p {
    margin: 0;
    display: flex;
    align-items: center;
  }
  
  .error-icon, .success-icon {
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
  
  @media (prefers-reduced-motion: reduce) {
    .error-message {
      animation: none;
    }
    
    .field-error {
      animation: none;
    }
  }
</style> 