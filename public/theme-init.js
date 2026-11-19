// Runs synchronously in <head> before first paint to avoid a theme flash.
// Public page: visitor override → profile default (from server-injected data) → OS preference.
// Admin pages: saved admin preference → OS preference.
;(function () {
  try {
    var root = document.documentElement
    var isAdmin = location.pathname.indexOf('/admin') === 0
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
    var saved = null
    try {
      saved = localStorage.getItem(isAdmin ? 'admin-theme' : 'profile-theme')
    } catch (e) {}
    var mode = saved
    var bg = null
    if (!isAdmin) {
      var el = document.getElementById('initial-data')
      if (el) {
        var data = JSON.parse(el.textContent || '{}')
        var p = data && data.profile
        if (p) {
          if (mode !== 'light' && mode !== 'dark') mode = p.themeMode
          if (mode === 'system' || (mode !== 'light' && mode !== 'dark')) mode = prefersDark ? 'dark' : 'light'
          bg = mode === 'dark' ? p.backgroundDark : p.backgroundLight
        }
      }
    }
    if (mode !== 'light' && mode !== 'dark') mode = prefersDark ? 'dark' : 'light'
    root.classList.toggle('dark', mode === 'dark')
    root.style.colorScheme = mode
    if (bg) root.style.backgroundColor = bg
  } catch (e) {}
})()
