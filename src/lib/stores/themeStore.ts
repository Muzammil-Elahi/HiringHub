import { writable } from 'svelte/store';
import { browser } from '$app/environment';

type Theme = 'light' | 'dark';

// Check if browser has preference for dark mode
const prefersDarkMode = browser && window.matchMedia('(prefers-color-scheme: dark)').matches;

// Check localStorage for saved theme preference
const getSavedTheme = (): Theme => {
  if (browser) {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light' || savedTheme === 'dark') {
      return savedTheme;
    }
  }
  // Default to system preference or light
  return prefersDarkMode ? 'dark' : 'light';
};

const createThemeStore = () => {
  const { subscribe, set, update } = writable<Theme>(getSavedTheme());

  return {
    subscribe,
    toggleTheme: () => {
      update(currentTheme => {
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        if (browser) {
          // Save preference to localStorage
          localStorage.setItem('theme', newTheme);
          // Apply theme class to document
          document.documentElement.setAttribute('data-theme', newTheme);
        }
        return newTheme;
      });
    },
    setTheme: (theme: Theme) => {
      set(theme);
      if (browser) {
        // Save preference to localStorage
        localStorage.setItem('theme', theme);
        // Apply theme class to document
        document.documentElement.setAttribute('data-theme', theme);
      }
    },
    initialize: () => {
      if (browser) {
        const currentTheme = getSavedTheme();
        document.documentElement.setAttribute('data-theme', currentTheme);
      }
    }
  };
};

const themeStore = createThemeStore();
export default themeStore; 