<script lang="ts">
  import { supabase } from '$lib/supabaseClient';
  import { selectedAccountType } from '$lib/stores/registrationStore';
  import { goto } from '$app/navigation';

  let fullName = ''; // Added full name field
  let email = '';
  let password = '';
  let confirmPassword = ''; // Added confirm password field
  let companyEmail = ''; // Added field for hiring managers
  let loading = false;
  let message = '';
  let messageType: 'error' | 'success' = 'error'; // To control message styling

  async function handleRegister() {
    if ($selectedAccountType !== 'hiring_manager') return; // Safety check

    // Basic client-side validation
    if (password !== confirmPassword) {
      message = 'Passwords do not match.';
      messageType = 'error';
      return;
    }
    if (password.length < 6) { // Example: Enforce minimum password length
        message = 'Password must be at least 6 characters long.';
        messageType = 'error';
        return;
    }
    // Basic check for company email format (could be more robust)
    if (!companyEmail.includes('@') || !companyEmail.includes('.')) {
        message = 'Please enter a valid company email address.';
        messageType = 'error';
        return;
    }

    loading = true;
    message = '';
    try {
      // Step 1: Sign up the user
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
      });

      if (signUpError) throw new Error(`User registration failed: ${signUpError.message}`);
      if (!signUpData.user) throw new Error('User registration failed, no user data returned.');

      // Step 2: Insert profile entry
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          user_id: signUpData.user.id, // Link to the newly created auth user
          account_type: 'hiring_manager',
          full_name: fullName, // Add full name from form
          email: email, // Keep email in profile but don't allow editing later
          company_name: companyEmail // Map companyEmail from form to company_name column
        });

      if (profileError) {
        // Optional: Attempt cleanup
        console.warn('Profile creation failed after signup for user:', signUpData.user.id, 'Error:', profileError);
        // Consider notifying the user or logging this server-side
        throw new Error(`Profile creation failed: ${profileError.message}`);
      }

      // Update success message
      message = 'Registration successful! Check your email for verification. Once verified, log in to access your profile.';
      messageType = 'success';
      fullName = ''; // Clear fields
      email = ''; // Clear fields on success
      password = '';
      confirmPassword = '';
      companyEmail = '';
      // Don't automatically navigate
      // await goto('/login'); // Removed automatic navigation

    } catch (error: any) {
      console.error('Registration process error:', error);
      if (error.message.includes('profileError')) {
          message = `Registration succeeded but profile creation failed: ${error.message}. Please contact support.`;
      } else if (error.message.includes('unique constraint') && error.message.includes('profiles_pkey')) {
          message = 'Registration error: Profile already exists for this user.';
      } else if (error.message.includes('Email rate limit exceeded')) {
          message = 'Registration failed: Too many attempts. Please try again later.';
      } else if (error.message.includes('User already registered')) {
          message = 'Registration failed: This email is already registered. Try logging in.';
      } else {
          message = `Registration failed: ${error.message}`; // Use just the message
      }
      messageType = 'error';
    } finally {
      loading = false;
    }
  }
</script>

{#if message}
  <!-- Use messageType for dynamic class -->
  <p class="message {messageType}" role="alert">{message}</p>
{/if}

<form on:submit|preventDefault={handleRegister} class="auth-sub-form">
  <div class="form-group">
    <label for="hm-fullname">Full Name</label>
    <input id="hm-fullname" type="text" bind:value={fullName} required placeholder="Your Full Name" disabled={loading} />
  </div>
  <div class="form-group">
    <label for="hm-email">Email</label>
    <input id="hm-email" type="email" bind:value={email} required placeholder="your@email.com" disabled={loading} />
  </div>
   <div class="form-group">
    <label for="hm-company-email">Company Email</label>
    <input id="hm-company-email" type="email" bind:value={companyEmail} required placeholder="work@company.com" disabled={loading} />
    <small>Please use your official company email address.</small> <!-- Added help text -->
  </div>
  <div class="form-group">
    <label for="hm-password">Password</label>
    <input id="hm-password" type="password" bind:value={password} required placeholder="••••••••" disabled={loading} minlength="6" />
  </div>
  <div class="form-group">
    <label for="hm-confirm-password">Confirm Password</label>
    <input id="hm-confirm-password" type="password" bind:value={confirmPassword} required placeholder="••••••••" disabled={loading} minlength="6" />
  </div>

  <button type="submit" class="btn-primary" disabled={loading} aria-live="polite">
    {loading ? 'Registering...' : 'Register as Hiring Manager'}
  </button>
</form>

<!-- Styles can be inherited or scoped -->
<style>
  /* Scoped styles for this specific form if needed, or rely on global/parent styles */
  .auth-sub-form {
      margin-top: var(--spacing-lg);
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

  .form-group small {
    display: block;
    margin-top: var(--spacing-xs);
    font-size: var(--font-size-sm);
    color: var(--text-muted-color, #6b7280); /* Provide a default */
  }

  /* Assuming a global .btn-primary style exists, otherwise define */
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

  /* Message styles (ensure they are defined globally or here) */
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
</style> 