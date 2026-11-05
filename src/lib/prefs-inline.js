/* Shipped inline in <head> (PrefsScript.astro); unit-tested as-is.
   Motion: effective = reduce if stored is 'reduce' OR the OS asks for reduce, else full.
   The OS setting is a floor; a stored 'full' never overrides it.
   data-motion-os=reduce is set before paint so the "set by your system" note has no CLS.
   Sound defaults to off.
   Theme: stored 'blue'/'paper', else the OS colour scheme (light -> paper); also sets theme-color.
   Legacy fragments (#projects #blog #experience #education, plus #skills #home)
   are rewritten with replaceState, then the hash is re-applied to scroll to the target. */
(function () {
  try {
    var d = document.documentElement;
    var m = null;
    var s = null;
    try {
      m = localStorage.getItem('nihal:motion');
    } catch {}
    try {
      s = localStorage.getItem('nihal:sound');
    } catch {}
    var th = null;
    try {
      th = localStorage.getItem('nihal:theme');
    } catch {}
    var q = false;
    try {
      q = matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {}
    if (q) d.dataset.motionOs = 'reduce';
    else delete d.dataset.motionOs;
    d.dataset.motion = m === 'reduce' || q ? 'reduce' : 'full';
    if (th !== 'blue' && th !== 'paper') {
      try {
        th = matchMedia('(prefers-color-scheme: light)').matches
          ? 'paper'
          : 'blue';
      } catch {
        th = 'blue';
      }
    }
    d.dataset.theme = th;
    var c = document.querySelector('meta[name=theme-color]');
    if (c) c.content = th === 'paper' ? '#F6F5F1' : '#1F3FE0';
    d.dataset.sound = s === 'on' ? 'on' : 'off';
    var t = {
      '#projects': '#work',
      '#blog': '#writing',
      '#experience': '#cv',
      '#education': '#cv',
      '#skills': '#cv',
      '#home': '#desk',
    }[location.hash];
    if (t) {
      history.replaceState(
        history.state,
        '',
        location.pathname + location.search + t,
      );
      location.hash = t;
    }
  } catch {}
})();
