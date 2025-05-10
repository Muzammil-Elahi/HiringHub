<script lang="ts">
  import { onMount } from 'svelte';
  import { goto } from '$app/navigation';
  import authStore from '$lib/stores/authStore';
  import userStore from '$lib/stores/userStore';
  import { page } from '$app/stores';
  
  // Form data
  let password = '';
  let confirmPassword = '';
  let loading = false;
  let error: string | null = null;
  let success = false;
  
  // Field-specific errors for better UX
  let passwordError: string | null = null;
  let confirmPasswordError: string | null = null;
  
  // Auto-redirect if already logged in
  onMount(() => {
    if ($userStore.loggedIn) {
      redirectToProfile();
    }
    
    // Reset auth store loading to ensure errors are visible
    authStore.setLoading(false);
  });
  
  // Validate password
  function validatePassword() {
    if (!password) {
      passwordError = 'Password is required';
      return false;
    }
    
    if (password.length < 6) {
      passwordError = 'Password must be at least 6 characters';
      return false;
    }
    
    passwordError = null;
    return true;
  }
  
  // Validate confirm password
  function validateConfirmPassword() {
    if (!confirmPassword) {
      confirmPasswordError = 'Please confirm your password';
      return false;
    }
    
    if (password !== confirmPassword) {
      confirmPasswordError = 'Passwords do not match';
      return false;
    }
    
    confirmPasswordError = null;
    return true;
  }
  
  // Focus handler to clear errors
  function handleFocus(field: 'password' | 'confirmPassword') {
    if (field === 'password') passwordError = null;
    if (field === 'confirmPassword') confirmPasswordError = null;
    error = null;
  }
  
  async function handlePasswordUpdate() {
    // Reset errors
    error = null;
    passwordError = null;
    confirmPasswordError = null;
    
    // Validate passwords
    const isPasswordValid = validatePassword();
    const isConfirmPasswordValid = validateConfirmPassword();
    
    if (!isPasswordValid || !isConfirmPasswordValid) {
      return; // Stop if validation fails
    }
    
    loading = true;
    
    try {
      // Update password
      const result = await authStore.updatePassword(password);
      
      if (!result.success) {
        // Format error messages
        const errorMessage = result.error instanceof Error 
          ? result.error.message 
          : typeof result.error === 'object' && result.error && 'message' in result.error
            ? (result.error as { message: string }).message
            : 'Password update failed';
        
        if (errorMessage.toLowerCase().includes('password')) {
          passwordError = errorMessage;
        } else {
          error = errorMessage;
        }
      } else {
        // Success - show success message and redirect after a delay
        success = true;
        setTimeout(() => {
          goto('/login');
        }, 3000); // Redirect after 3 seconds
      }
    } catch (err: any) {
      console.error('Password update error:', err);
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

<div class="container auth-page">
  <div class="auth-card">
    <h2>Reset Your Password</h2>
    
    {#if error}
      <div class="error-message">
        <p><span class="error-icon">⚠️</span> {error}</p>
      </div>
    {/if}
    
    {#if success}
      <div class="success-message">
        <p><span class="success-icon">✓</span> Password updated successfully! Redirecting to login page...</p>
      </div>
    {/if}
    
    <form on:submit|preventDefault={handlePasswordUpdate}>
      <div class="form-group {passwordError ? 'has-error' : ''}">
        <label for="password">New Password</label>
        <input
          id="password"
          type="password"
          placeholder="Minimum 6 characters"
          bind:value={password}
          on:focus={() => handleFocus('password')}
          class:error-input={passwordError}
          disabled={loading || success}
          required
        />
        {#if passwordError}
          <div class="field-error">
            <p>{passwordError}</p>
          </div>
        {/if}
      </div>
      
      <div class="form-group {confirmPasswordError ? 'has-error' : ''}">
        <label for="confirmPassword">Confirm Password</label>
        <input
          id="confirmPassword"
          type="password"
          placeholder="Re-enter your new password"
          bind:value={confirmPassword}
          on:focus={() => handleFocus('confirmPassword')}
          class:error-input={confirmPasswordError}
          disabled={loading || success}
          required
        />
        {#if confirmPasswordError}
          <div class="field-error">
            <p>{confirmPasswordError}</p>
          </div>
        {/if}
      </div>
      
      <div class="form-info">
        <p>Create a new password with at least 6 characters.</p>
      </div>
      
      <div class="form-actions">
        <button type="submit" class="btn-primary" disabled={loading || success}>
          {loading ? 'Updating...' : 'Update Password'}
        </button>
      </div>
    </form>
    
    <div class="auth-footer">
      <p>Remember your password? <a href="/login">Log In</a></p>
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
</style> 