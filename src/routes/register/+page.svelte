<script lang="ts">
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
  
  async function handleRegister() {
    // Basic validation
    if (!email || !password || !confirmPassword) {
      error = 'All fields are required';
      return;
    }
    
    if (password !== confirmPassword) {
      error = 'Passwords do not match';
      return;
    }
    
    if (password.length < 6) {
      error = 'Password must be at least 6 characters long';
      return;
    }
    
    loading = true;
    error = '';
    
    try {
      // Use the auth store for registration
      const result = await authStore.register(email, password);
      
      if (!result.success) {
        throw new Error(result.error.message || 'Registration failed');
      }
      
      const userId = result.data.user?.id;
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
      error = err.message || 'An error occurred during registration';
      loading = false;
    }
  }
</script>

<div class="container auth-page">
  <div class="auth-card">
    <h2>Register for HiringHub</h2>
    
    {#if error}
      <div class="error-message">
        <p>{error}</p>
      </div>
    {/if}
    
    <form on:submit|preventDefault={handleRegister}>
      <div class="form-group">
        <label for="email">Email</label>
        <input 
          id="email" 
          type="email" 
          bind:value={email} 
          placeholder="your@email.com" 
          disabled={loading}
          required
        />
      </div>
      
      <div class="form-group">
        <label for="password">Password</label>
        <input 
          id="password" 
          type="password" 
          bind:value={password} 
          placeholder="Minimum 6 characters" 
          disabled={loading}
          required
        />
      </div>
      
      <div class="form-group">
        <label for="confirmPassword">Confirm Password</label>
        <input 
          id="confirmPassword" 
          type="password" 
          bind:value={confirmPassword} 
          placeholder="Enter password again" 
          disabled={loading}
          required
        />
      </div>
      
      <div class="form-group">
        <label>Account Type</label>
        <div class="radio-group">
          <label class="radio-label">
            <input 
              type="radio" 
              bind:group={accountType} 
              value="job_seeker" 
              disabled={loading}
            />
            Job Seeker
          </label>
          <label class="radio-label">
            <input 
              type="radio" 
              bind:group={accountType} 
              value="hiring_manager" 
              disabled={loading}
            />
            Hiring Manager
          </label>
        </div>
      </div>
      
      <div class="form-actions">
        <button type="submit" class="btn-primary" disabled={loading}>
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
  
  .form-group input[type="email"],
  .form-group input[type="password"] {
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