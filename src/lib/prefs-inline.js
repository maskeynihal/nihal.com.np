/* Shipped inline in <head> (PrefsScript.astro); unit-tested as-is.
   Motion: effective = reduce if stored is 'reduce' OR the OS asks for reduce, else full.
   The OS setting is a floor; a stored 'full' never overrides it.
   data-motion-os=reduce is set before paint so the "set by your system" note has no CLS.
   Sound defaults to off.
   Lamp: stored level 0-4 (nihal:lamp), else the old theme choice (blue 1, paper 4), else the OS
   colour scheme (light 4, dark 1). Sets data-lamp, data-theme (paper for 4/3/2, blue for 1/0)
   and theme-color.
   Legacy fragments (#work #blog #experience #education, plus #skills #home)
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
    var l = null;
    try {
      l = localStorage.getItem('nihal:lamp');
    } catch {}
    l = /^[0-4]$/.test(l) ? +l : th === 'paper' ? 4 : th === 'blue' ? 1 : null;
    if (l === null) {
      try {
        l = matchMedia('(prefers-color-scheme: light)').matches ? 4 : 1;
      } catch {
        l = 1;
      }
    }
    d.dataset.lamp = l;
    d.dataset.theme = l > 1 ? 'paper' : 'blue';
    var c = document.querySelector('meta[name=theme-color]');
    if (c)
      c.content = ['#0A1348', '#1F3FE0', '#B3B4C6', '#E6E4DC', '#F6F5F1'][l];
    d.dataset.sound = s === 'on' ? 'on' : 'off';
    var t = {
      '#work': '#projects',
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
