/* Applies the saved light or dark look before the page paints (a per-browser choice; nothing leaves the device). */
try {
  var t = localStorage.getItem('wiki-theme');
  if (t === 'dark' || t === 'light') document.documentElement.setAttribute('data-theme', t);
} catch (e) { /* storage blocked: the device's own setting applies */ }
