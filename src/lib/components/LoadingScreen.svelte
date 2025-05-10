<script lang="ts">
  import { fade } from 'svelte/transition';
  
  export let message = "Loading...";
  export let timeout = 15000; // Add a timeout to avoid infinite loading
  
  // Set up a timeout to automatically hide the loading screen
  // after a certain period to prevent infinite loading issues
  import { onMount, onDestroy } from 'svelte';
  import { get } from 'svelte/store';
  import authStore from '$lib/stores/authStore';
  
  let timeoutId: NodeJS.Timeout;
  
  onMount(() => {
    timeoutId = setTimeout(() => {
      // Force reset loading state after timeout
      authStore.setLoading(false);
      console.warn('Loading screen timed out');
    }, timeout);
  });
  
  onDestroy(() => {
    if (timeoutId) clearTimeout(timeoutId);
  });
</script>

<div class="loading-screen" transition:fade={{ duration: 150 }}>
  <div class="loading-content">
    <div class="spinner"></div>
    <p class="loading-text">{message}</p>
  </div>
</div>

<style>
  .loading-screen {
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(var(--background-color-rgb, 249, 250, 251), 0.85);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 9999;
    backdrop-filter: blur(3px);
  }

  .loading-content {
    text-align: center;
    background-color: var(--surface-color, white);
    padding: 2rem;
    border-radius: var(--border-radius, 0.375rem);
    box-shadow: var(--box-shadow-md, 0 4px 6px rgba(0, 0, 0, 0.1));
    max-width: 90%;
    width: 300px;
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid var(--border-color, #f3f3f3);
    border-top: 4px solid var(--primary-color, #3498db);
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
    margin: 0 auto 1rem;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .loading-text {
    font-size: 1rem;
    color: var(--text-color, #333);
    margin: 0;
  }
  
  /* Dark mode support */
  :global([data-theme="dark"]) .loading-screen {
    background-color: rgba(var(--background-color-rgb, 17, 24, 39), 0.9);
  }
</style> 