<script lang="ts">
  import themeStore from '$lib/stores/themeStore';
  
  // Toggle the theme when button is clicked
  function toggleTheme() {
    themeStore.toggleTheme();
  }
  
  // Handle keyboard events
  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      toggleTheme();
    }
  }
</script>

<button 
  type="button" 
  class="theme-toggle" 
  on:click={toggleTheme}
  on:keydown={handleKeydown}
  role="switch"
  aria-pressed={$themeStore === 'dark'}
  aria-label={$themeStore === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
  tabindex="0"
>
  <span class="visually-hidden">
    {$themeStore === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
  </span>
  
  {#if $themeStore === 'light'}
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      stroke-width="2" 
      stroke-linecap="round" 
      stroke-linejoin="round" 
      class="moon-icon"
      aria-hidden="true"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path>
    </svg>
  {:else}
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      stroke-width="2" 
      stroke-linecap="round" 
      stroke-linejoin="round" 
      class="sun-icon"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="5"></circle>
      <line x1="12" y1="1" x2="12" y2="3"></line>
      <line x1="12" y1="21" x2="12" y2="23"></line>
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line>
      <line x1="1" y1="12" x2="3" y2="12"></line>
      <line x1="21" y1="12" x2="23" y2="12"></line>
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line>
    </svg>
  {/if}
</button>

<style>
  .theme-toggle {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--text-color);
    background-color: var(--surface-secondary-color);
    transition: background-color 0.3s, color 0.3s, transform 0.2s;
    position: relative;
  }
  
  .theme-toggle:hover {
    background-color: var(--surface-hover-color);
    transform: scale(1.1);
  }
  
  .theme-toggle:focus {
    outline: var(--focus-ring-width) solid var(--focus-ring-color);
    outline-offset: var(--focus-ring-offset);
  }
  
  .moon-icon, .sun-icon {
    width: 20px;
    height: 20px;
  }
  
  /* Animation for icon switch */
  @keyframes spin-in {
    from { transform: rotate(-180deg) scale(0); opacity: 0; }
    to { transform: rotate(0) scale(1); opacity: 1; }
  }
  
  svg {
    animation: spin-in 0.4s ease-out;
  }
  
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  }
</style> 