(() => {
  function getSavedTheme() {
    try {
      return localStorage.getItem('theme') || 'arctic-blue';
    } catch {
      return 'arctic-blue';
    }
  }

  function resolveTheme(preference) {
    if (
      preference === 'midnight-indigo' ||
      preference === 'arctic-blue' ||
      preference === 'forest-mint' ||
      preference === 'obsidian-violet'
    ) {
      return preference;
    }
    if (
      preference === 'dark' ||
      (preference === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
    ) {
      return 'midnight-indigo';
    }
    return 'arctic-blue';
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
  }

  applyTheme(resolveTheme(getSavedTheme()));
})();
