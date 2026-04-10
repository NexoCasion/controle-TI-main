(function() {
  const storageKey = 'app-theme';

  function getRoot() {
    return document.documentElement;
  }

  function getPreferredTheme() {
    return window.matchMedia &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  function getSavedTheme() {
    try {
      const savedTheme = localStorage.getItem(storageKey);
      if (savedTheme === 'dark' || savedTheme === 'light') {
        return savedTheme;
      }
    } catch (error) {}

    return null;
  }

  function getTheme() {
    const current = getRoot().getAttribute('data-theme');
    return current === 'dark' ? 'dark' : 'light';
  }

  function setTheme(theme) {
    const root = getRoot();
    root.setAttribute('data-theme', theme);
    root.classList.toggle('dark', theme === 'dark');

    try {
      localStorage.setItem(storageKey, theme);
    } catch (error) {}

    window.dispatchEvent(new CustomEvent('app-theme-changed', { detail: { theme } }));
  }

  function bootTheme() {
    const root = getRoot();

    try {
      const theme = getSavedTheme() || getPreferredTheme();
      root.setAttribute('data-theme', theme);
      root.classList.toggle('dark', theme === 'dark');
    } catch (error) {
      root.setAttribute('data-theme', 'light');
      root.classList.remove('dark');
    }
  }

  function toggleTheme(originEvent) {
    const root = getRoot();
    const nextTheme = getTheme() === 'dark' ? 'light' : 'dark';
    const prefersReducedMotion =
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const runThemeChange = () => setTheme(nextTheme);

    if (!prefersReducedMotion && typeof document.startViewTransition === 'function') {
      const x = Number(originEvent?.clientX || window.innerWidth / 2);
      const y = Number(originEvent?.clientY || window.innerHeight / 2);
      const maxRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
      );

      root.style.setProperty('--theme-transition-x', `${x}px`);
      root.style.setProperty('--theme-transition-y', `${y}px`);
      root.style.setProperty('--theme-transition-radius', `${maxRadius}px`);
      root.classList.add('theme-transition-active');

      const transition = document.startViewTransition(() => {
        runThemeChange();
      });

      transition.finished.finally(() => {
        root.classList.remove('theme-transition-active');
        root.style.removeProperty('--theme-transition-x');
        root.style.removeProperty('--theme-transition-y');
        root.style.removeProperty('--theme-transition-radius');
      });

      return;
    }

    runThemeChange();
  }

  window.__appTheme = {
    boot: bootTheme,
    getTheme,
    setTheme,
    toggleTheme,
  };

  window.toggleTheme = toggleTheme;
})();
