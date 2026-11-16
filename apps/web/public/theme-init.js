(() => {
  function getSavedTheme() {
    try {
      return localStorage.getItem('theme') || 'system';
    } catch {
      return 'system';
    }
  }

  function resolveTheme(preference) {
    if (
      preference === 'light' ||
      preference === 'dark' ||
      preference === 'blush' ||
      preference === 'rose'
    ) {
      return preference;
    }

    return matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
  }

  applyTheme(resolveTheme(getSavedTheme()));
})();
