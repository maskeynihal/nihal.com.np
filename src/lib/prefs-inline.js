/* Shipped inline in <head> (see PrefsScript.astro); unit-tested as-is.
   Motion rule: the OS setting is a floor. effective = reduce if stored is
   'reduce' OR prefers-reduced-motion matches, else full; a stored 'full'
   never overrides the OS. data-motion-os=reduce marks the OS state before
   paint so the "set by your system" note exists (display) only then. Sound defaults to off.
   Legacy map: #projects #about #blog #experience #education are the specified
   ones; #skills and #home are intentional extras.
   Legacy fragments are rewritten in place: replaceState (no extra history
   entry), then the hash is re-applied so the browser scrolls to the target. */
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
    var q = false;
    try {
      q = matchMedia('(prefers-reduced-motion: reduce)').matches;
    } catch {}
    if (q) d.dataset.motionOs = 'reduce';
    else delete d.dataset.motionOs;
    d.dataset.motion = m === 'reduce' || q ? 'reduce' : 'full';
    d.dataset.sound = s === 'on' ? 'on' : 'off';
    var t = {
      '#projects': '#work',
      '#about': '#desk',
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
