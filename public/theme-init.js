// Set the theme before first paint so there is no flash. Light or dark only.
// This is a separate file, not inline in the page, so the Content Security Policy can forbid inline scripts.
try {
  if (localStorage.getItem('theme') === 'dark') document.documentElement.classList.add('dark')
  if (localStorage.getItem('density') === 'compact') document.documentElement.dataset.density = 'compact'
} catch (e) {}
