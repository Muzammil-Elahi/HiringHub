<script lang="ts">
  import { supabase } from '$lib/supabaseClient'; // Updated path
  import { goto } from '$app/navigation'; // SvelteKit navigation
  import authStore from '$lib/stores/authStore'; // Import the auth store

  let email = '';
  let password = '';
  let loading = false;
  let message = '';
  let messageType: 'error' | 'success' = 'error';

  async function handleLogin() {
    loading = true;
    message = '';
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) throw error;
      
      // Update auth store with session data
      authStore.setSession(data.session);

      // The redirection will be handled by the auth state change handler in +layout.svelte
      // No need to redirect here

    } catch (error: any) {
      message = `Login failed: ${error.error_description || error.message}`;
      messageType = 'error';
    } finally {
      loading = false;
    }
  }
</script>

<div class="container auth-form">
  <h2 class="text-center">Log In</h2>

  {#if message}
    <p class="message {messageType}" role="alert">{message}</p>
  {/if}

  <form on:submit|preventDefault={handleLogin}>
    <div class="form-group">
      <label for="login-email">Email</label>
      <input id="login-email" type="email" bind:value={email} required placeholder="your@email.com" disabled={loading} />
    </div>
    <div class="form-group">
      <label for="login-password">Password</label>
      <input id="login-password" type="password" bind:value={password} required placeholder="••••••••" disabled={loading} />
    </div>

    <button type="submit" class="btn-primary" disabled={loading} aria-live="polite">
      {loading ? 'Logging in...' : 'Log In'}
    </button>
  </form>

  <p class="text-center mt-4">
    Don't have an account? <a href="/register">Register</a> <!-- Standard link -->
  </p>
</div>

<style>
  /* Reuse styles similar to Register.svelte and its sub-components */
  .auth-form {
    max-width: 400px;
    margin: var(--spacing-xl) auto;
    padding: var(--spacing-lg);
    background-color: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    box-shadow: var(--box-shadow);
  }

  .form-group {
    margin-bottom: var(--spacing-md);
  }

  .form-group label {
    display: block;
    margin-bottom: var(--spacing-xs);
    font-weight: 500;
    color: var(--text-color);
  }

  .form-group input {
    width: 100%;
    padding: var(--spacing-sm) var(--spacing-md);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    font-size: var(--font-size-base);
    background-color: var(--input-bg-color, var(--surface-color));
    color: var(--text-color);
    transition: border-color 0.2s ease, box-shadow 0.2s ease;
  }

   .form-group input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 3px rgba(var(--primary-color-rgb), 0.2);
  }

  .btn-primary {
    width: 100%;
    padding: var(--spacing-md);
    background-color: var(--primary-color);
    color: var(--primary-contrast-color);
    border: none;
    border-radius: var(--border-radius);
    cursor: pointer;
    font-size: var(--font-size-base);
    font-weight: 500;
    transition: background-color 0.2s ease;
    text-align: center;
  }

  .btn-primary:hover:not(:disabled) {
      background-color: var(--primary-color-dark);
  }

  .btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
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

  /* No success message style needed for login page as we redirect */

  .text-center {
    text-align: center;
  }

  .mt-4 {
      margin-top: var(--spacing-lg); /* Or adjust as needed */
  }

  /* Updated link styling slightly */
  a {
      color: var(--primary-color);
      text-decoration: none;
      cursor: pointer; /* Explicitly set cursor */
  }

  a:hover {
      text-decoration: underline;
  }
</style> 