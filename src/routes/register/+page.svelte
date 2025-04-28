<script lang="ts">
  import { supabase } from '$lib/supabaseClient'; // Path updated
  import { selectedAccountType, type AccountType } from '$lib/stores/registrationStore'; // Path updated
  import JobSeekerRegisterForm from '$lib/components/auth/JobSeekerRegisterForm.svelte'; // Path updated
  import HiringManagerRegisterForm from '$lib/components/auth/HiringManagerRegisterForm.svelte'; // Path updated
  // import { navigateTo } from '../lib/stores/navigationStore'; // Remove old navigation

  let loading = false;
  let message = '';

  function selectAccountType(type: AccountType | null) { // Allow null to reset
    selectedAccountType.set(type);
    message = '';
  }
</script>

<div class="container auth-form">
  <h2 class="text-center">Create Your Account</h2>

  {#if $selectedAccountType === null}
    <p class="text-center">Please select your account type:</p>
    <div class="account-type-selector">
      <button class="btn" on:click={() => selectAccountType('job_seeker')}>
        I'm a Job Seeker
      </button>
      <button class="btn" on:click={() => selectAccountType('hiring_manager')}>
        I'm Hiring
      </button>
    </div>
    <p class="text-center mt-4">
      Already have an account? <a href="/login">Log in</a> <!-- Standard link -->
    </p>
  {:else}
    <p class="text-center">
      Registering as a {$selectedAccountType === 'job_seeker' ? 'Job Seeker' : 'Hiring Manager'}
      <button class="btn-link" on:click={() => selectAccountType(null)}>(Change)</button>
    </p>

    {#if message}
      <p class="message {message.includes('failed') ? 'error' : 'success'}" role="alert">{message}</p>
    {/if}

    {#if $selectedAccountType === 'job_seeker'}
      <JobSeekerRegisterForm />
    {:else if $selectedAccountType === 'hiring_manager'}
      <HiringManagerRegisterForm />
    {/if}

    <p class="text-center mt-4">
      Already have an account? <a href="/login">Log in</a> <!-- Standard link -->
    </p>
  {/if}

</div>

<style>
  /* Keep existing styles */
  .auth-form {
    max-width: 400px;
    margin: var(--spacing-xl) auto;
    padding: var(--spacing-lg);
    background-color: var(--surface-color);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    box-shadow: var(--box-shadow);
  }

  .account-type-selector {
    display: flex;
    justify-content: space-around;
    margin-bottom: var(--spacing-lg);
    gap: var(--spacing-md);
  }

  .account-type-selector button {
     flex: 1;
     padding: var(--spacing-md); /* Make buttons larger */
  }

  .btn-link {
    background: none;
    border: none;
    color: var(--primary-color);
    text-decoration: underline;
    cursor: pointer;
    font-size: var(--font-size-sm);
    padding: 0;
    margin-left: var(--spacing-xs);
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
    padding: var(--spacing-sm);
    border: 1px solid var(--border-color);
    border-radius: var(--border-radius);
    font-size: var(--font-size-base);
  }

  .form-group input:focus {
    outline: none;
    border-color: var(--primary-color);
    box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.2); /* Blue focus ring */
  }

  /* Button styles might need adjustments if you have global button styles */
  button.btn {
    /* Default button styles defined in app.css will apply */
     /* Add any overrides specific to .btn class here if needed */
  }

  /* Use more specific selectors if .btn might clash */
  .account-type-selector button.btn {
     /* Styles specific to account type buttons */
  }


  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Keep message styles */
  .message {
    padding: var(--spacing-sm);
    margin-bottom: var(--spacing-md);
    border-radius: var(--border-radius);
    text-align: center;
  }

  .message.error {
    background-color: var(--error-bg-color, #fee2e2); /* Added fallbacks */
    color: var(--error-text-color, #b91c1c);
    border: 1px solid var(--error-border-color, #fca5a5);
  }

  .message.success {
    background-color: var(--success-bg-color, #dcfce7);
    color: var(--success-text-color, #166534);
    border: 1px solid var(--success-border-color, #86efac);
  }

  /* Ensure link styling is consistent if needed */
  a {
    color: var(--primary-color);
    text-decoration: none;
    cursor: pointer;
  }

  a:hover {
    text-decoration: underline;
  }

  .text-center {
    text-align: center;
  }

  .mt-4 {
      margin-top: var(--spacing-lg);
  }
</style> 