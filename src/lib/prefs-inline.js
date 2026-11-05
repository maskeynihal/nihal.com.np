/* Shipped inline in <head> (see PrefsScript.astro); unit-tested as-is.
   Motion rule: stored 'reduce' wins; stored 'full' overrides the
   prefers-reduced-motion media query ONLY because the user explicitly chose
   it; with nothing stored the media query decides. Sound defaults to off.
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
    d.dataset.motion =
      m === 'reduce' || (m !== 'full' && q) ? 'reduce' : 'full';
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
