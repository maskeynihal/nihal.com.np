/**
 * Behaviour of the sheet index (B-01). DOM only; no content imports (client bundle).
 *  - `aria-current="location"` on the row whose section crosses the viewport midline
 *    (IntersectionObserver with rootMargin -50% 0 -50%, so the root is a zero-height line).
 *  - `--progress` (0..1) on <html> when the CSS scroll timeline cannot drive the rule.
 *  - `nihal:drag` (CustomEvent<{ active: boolean }> on window, sent by the desk in E-05)
 *    dims the index to 40% while a body is dragged.
 */

const MIDLINE = '-50% 0px -50% 0px';

export function nativeProgress(doc: Document = document): boolean {
  return (
    typeof CSS !== 'undefined' &&
    CSS.supports('animation-timeline: scroll()') &&
    doc.documentElement.dataset['motion'] !== 'reduce'
  );
}

export function progressOf(
  scrollY: number,
  innerHeight: number,
  scrollHeight: number,
): number {
  const max = scrollHeight - innerHeight;
  return max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
}

export function initSheetIndex(nav: HTMLElement): void {
  const doc = document.documentElement;
  const links = [...nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
  const targets = links.map((a) => document.getElementById(a.hash.slice(1)));
  const inView = new Set<number>();
  const list = nav.querySelector<HTMLElement>('.sheet-index-list');
  let current = -1;

  const setCurrent = (i: number) => {
    if (i === current || i < 0) return;
    current = i;
    links.forEach((a, n) => {
      if (n === i) a.setAttribute('aria-current', 'location');
      else a.removeAttribute('aria-current');
    });
    // In the bottom strip the list scrolls sideways; keep the current row visible.
    const link = links[i];
    if (list && link && list.scrollWidth > list.clientWidth)
      list.scrollLeft =
        link.offsetLeft - (list.clientWidth - link.offsetWidth) / 2;
  };

  const resolve = () => {
    const atBottom =
      window.scrollY + window.innerHeight >= doc.scrollHeight - 2;
    if (atBottom) return setCurrent(links.length - 1);
    // Adjacent sections can both touch the line; the later one wins.
    const hit = Math.max(-1, ...inView);
    if (hit >= 0) setCurrent(hit);
    else if (current < 0) setCurrent(0);
  };

  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          const i = targets.indexOf(e.target as HTMLElement);
          if (i < 0) continue;
          if (e.isIntersecting) inView.add(i);
          else inView.delete(i);
        }
        resolve();
      },
      { rootMargin: MIDLINE, threshold: 0 },
    );
    for (const t of targets) if (t) io.observe(t);
  }

  let frame = 0;
  const tick = () => {
    frame = 0;
    resolve();
    if (!nativeProgress()) {
      const p = progressOf(
        window.scrollY,
        window.innerHeight,
        doc.scrollHeight,
      );
      doc.style.setProperty('--progress', p.toFixed(4));
    }
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };
  window.addEventListener('scroll', schedule, { passive: true });
  window.addEventListener('resize', schedule, { passive: true });
  // Motion can flip at runtime; recompute so the right driver owns the rule.
  new MutationObserver(schedule).observe(doc, {
    attributes: true,
    attributeFilter: ['data-motion'],
  });
  schedule();

  window.addEventListener('nihal:drag', (e) => {
    const detail = (e as CustomEvent<{ active?: boolean } | undefined>).detail;
    nav.toggleAttribute('data-dim', detail?.active === true);
  });
}
