// theme-boot.ts: synchronous theme initialization
try {
  const theme = localStorage.getItem('hush_theme') || 'system';
  const effectiveTheme =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;
  document.documentElement.setAttribute('data-theme', effectiveTheme);
} catch {
  document.documentElement.setAttribute('data-theme', 'light');
}
