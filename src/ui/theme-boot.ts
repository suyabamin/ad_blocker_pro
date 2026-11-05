// src/ui/theme-boot.ts
// Synchronously sets data-theme on <html> before first paint (03_UI_Spec §2)

try {
  const prefersDark =
    typeof window !== 'undefined' &&
    window.matchMedia &&
    window.matchMedia('(prefers-color-scheme: dark)').matches;

  document.documentElement.setAttribute(
    'data-theme',
    prefersDark ? 'dark' : 'light'
  );
} catch {
  document.documentElement.setAttribute('data-theme', 'light');
}
