(() => {
  const currentFile = (window.location.pathname.split('/').pop() || 'index.html').toLowerCase();
  const strandPages = new Set(['print.html', 'dental.html']);
  const showBackToggle = strandPages.has(currentFile);

  document.querySelectorAll('[data-standard-nav]').forEach((element) => {
    element.hidden = showBackToggle;
  });

  document.querySelectorAll('[data-portraits-toggle]').forEach((element) => {
    element.hidden = !showBackToggle;
  });
})();
