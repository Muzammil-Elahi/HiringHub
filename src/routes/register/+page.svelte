<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import { supabase } from '$lib/supabaseClient';
  import authStore from '$lib/stores/authStore';
  import userStore from '$lib/stores/userStore';
  
  // Form fields
  let email = '';
  let password = '';
  let confirmPassword = '';
  let accountType: 'job_seeker' | 'hiring_manager' = 'job_seeker';
  
  // UI state
  let loading = false;
  let error = '';
  
  // Field-specific errors
  let emailError = '';
  let passwordError = '';
  let confirmPasswordError = '';
  
  onMount(() => {
    // Reset auth store loading to ensure errors are visible
    authStore.setLoading(false);
  });
  
  // Validation functions
  function validateEmail() {
    if (!email.trim()) {
      emailError = 'Email is required';
      return false;
    }
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      emailError = 'Please enter a valid email address';
      return false;
    }
    
    emailError = '';
    return true;
  }
  
  function validatePassword() {
    if (!password) {
      passwordError = 'Password is required';
      return false;
    }
    
    if (password.length < 6) {
      passwordError = 'Password must be at least 6 characters long';
      return false;
    }
    
    // Add more password requirements if needed (uppercase, numbers, special chars)
    passwordError = '';
    return true;
  }
  
  function validateConfirmPassword() {
    if (!confirmPassword) {
      confirmPasswordError = 'Please confirm your password';
      return false;
    }
    
    if (password !== confirmPassword) {
      confirmPasswordError = 'Passwords do not match';
      return false;
    }
    
    confirmPasswordError = '';
    return true;
  }
  
  // Clear errors when user focuses on a field
  function handleFocus(field: string) {
    error = '';
    
    if (field === 'email') emailError = '';
    if (field === 'password') passwordError = '';
    if (field === 'confirmPassword') confirmPasswordError = '';
  }
  
  async function handleRegister() {
    // Reset all errors first
    error = '';
    emailError = '';
    passwordError = '';
    confirmPasswordError = '';
    
    // Validate all fields
    const isEmailValid = validateEmail();
    const isPasswordValid = validatePassword();
    const isConfirmPasswordValid = validateConfirmPassword();
    
    // Stop if any validation fails
    if (!isEmailValid || !isPasswordValid || !isConfirmPasswordValid) {
      return;
    }
    
    loading = true;
    
    try {
      // Use the auth store for registration
      const result = await authStore.register(email, password);
      
      if (!result.success) {
        // Format error messages in a user-friendly way
        const errorMessage = result.error ? (
          typeof result.error === 'object' && 'message' in result.error 
            ? String(result.error.message) 
            : 'Registration failed'
        ) : 'Registration failed';
        
        if (errorMessage.toLowerCase().includes('email')) {
          emailError = errorMessage;
        } else if (errorMessage.toLowerCase().includes('password')) {
          passwordError = errorMessage;
        } else if (errorMessage.toLowerCase().includes('already registered')) {
          emailError = 'This email is already registered. Please login instead.';
        } else {
          error = errorMessage;
        }
        
        // Ensure loading states are turned off
        loading = false;
        authStore.setLoading(false);
        throw new Error(errorMessage);
      }
      
      const userId = result.data?.user?.id;
      if (!userId) {
        throw new Error('Failed to get user ID after registration');
      }
      
      // Create profile for the new user
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: userId,
          account_type: accountType,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        
      if (profileError) throw profileError;
      
      // Success - just keep loading state active
      // The redirection will be handled by the layout component
      console.log('Registration successful, waiting for redirect...');
      
    } catch (err: any) {
      console.error('Registration error:', err);
      if (!error && !emailError && !passwordError && !confirmPasswordError) {
        error = err.message || 'An error occurred during registration';
      }
      loading = false;
      authStore.setLoading(false);
    }
  }
</script>

<svelte:head>
  <title>Register - HiringHub</title>
  <meta name="description" content="Create your HiringHub account to connect with opportunities or find top talent.">
</svelte:head>

<div class="container auth-page">
  <div class="auth-card" role="region" aria-label="Registration form">
    <h1>Register for HiringHub</h1>
    
    {#if error}
      <div class="error-message" role="alert" aria-live="assertive">
        <p><span class="error-icon" aria-hidden="true">⚠️</span> {error}</p>
      </div>
    {/if}
    
    <form on:submit|preventDefault={handleRegister} novalidate>
      <div class="form-group {emailError ? 'has-error' : ''}">
        <label for="email" id="email-label">Email</label>
        <input 
          id="email" 
          type="email" 
          bind:value={email} 
          on:focus={() => handleFocus('email')}
          on:blur={validateEmail}
          placeholder="your@email.com" 
          class:error-input={emailError}
          disabled={loading}
          aria-required="true"
          aria-invalid={!!emailError}
          aria-describedby={emailError ? 'email-error' : undefined}
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
          bind:value={password} 
          on:focus={() => handleFocus('password')}
          on:blur={validatePassword}
          placeholder="Minimum 6 characters" 
          class:error-input={passwordError}
          disabled={loading}
          aria-required="true"
          aria-invalid={!!passwordError}
          aria-describedby={passwordError ? 'password-error' : 'password-hint'}
          required
        />
        <div id="password-hint" class="field-hint">Password must be at least 6 characters long</div>
        {#if passwordError}
          <div class="field-error" id="password-error" role="alert">
            <p>{passwordError}</p>
          </div>
        {/if}
      </div>
      
      <div class="form-group {confirmPasswordError ? 'has-error' : ''}">
        <label for="confirmPassword" id="confirm-password-label">Confirm Password</label>
        <input 
          id="confirmPassword" 
          type="password" 
          bind:value={confirmPassword} 
          on:focus={() => handleFocus('confirmPassword')}
          on:blur={validateConfirmPassword}
          placeholder="Enter password again"
          class:error-input={confirmPasswordError}
          disabled={loading}
          aria-required="true"
          aria-invalid={!!confirmPasswordError}
          aria-describedby={confirmPasswordError ? 'confirm-password-error' : undefined}
          required
        />
        {#if confirmPasswordError}
          <div class="field-error" id="confirm-password-error" role="alert">
            <p>{confirmPasswordError}</p>
          </div>
        {/if}
      </div>
      
      <fieldset class="account-type-fieldset">
        <legend>Account Type</legend>
        <div class="radio-group" role="radiogroup" aria-required="true">
          <label class="radio-label">
            <input 
              type="radio" 
              id="job-seeker"
              name="accountType"
              bind:group={accountType} 
              value="job_seeker" 
              disabled={loading}
              checked
            />
            <span>Job Seeker</span>
          </label>
          <label class="radio-label">
            <input 
              type="radio" 
              id="hiring-manager"
              name="accountType"
              bind:group={accountType} 
              value="hiring_manager" 
              disabled={loading}
            />
            <span>Hiring Manager</span>
          </label>
        </div>
      </fieldset>
      
      <div class="form-actions">
        <button 
          type="submit" 
          class="btn-primary" 
          disabled={loading}
          aria-busy={loading}
        >
          {loading ? 'Registering...' : 'Create Account'}
        </button>
      </div>
    </form>
    
    <div class="auth-footer">
      <p>Already have an account? <a href="/login">Log In</a></p>
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
    position: relative;
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
  
  .form-group input[type="email"],
  .form-group input[type="password"] {
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
  
  .field-hint {
    color: var(--text-muted-color);
    font-size: 0.85rem;
    margin-top: 0.25rem;
  }
  
  .account-type-fieldset {
    border: none;
    padding: 0;
    margin: 0 0 var(--spacing-md) 0;
  }
  
  .account-type-fieldset legend {
    display: block;
    margin-bottom: var(--spacing-xs);
    font-weight: 500;
    transition: color 0.2s ease;
    float: none;
    width: 100%;
  }
  
  .radio-group {
    display: flex;
    gap: var(--spacing-lg);
    margin-top: var(--spacing-xs);
  }
  
  .radio-label {
    display: flex;
    align-items: center;
    gap: var(--spacing-xs);
    cursor: pointer;
    padding: var(--spacing-xs) 0;
  }
  
  .radio-label input[type="radio"] {
    width: 20px;
    height: 20px;
    cursor: pointer;
  }
  
  .radio-label input[type="radio"]:focus {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
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