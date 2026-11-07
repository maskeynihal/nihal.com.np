/**
 * Behaviour of the sheet index (B-01). DOM only; no content imports (client bundle).
 *  - `aria-current="location"` on the row whose section crosses the viewport midline
 *    (IntersectionObserver with rootMargin -50% 0 -50%, so the root is a zero-height line).
 *  - `--progress` (0..1) on <html> when the CSS scroll timeline cannot drive the rule.
 *  - Row clicks scroll with an eased, JS-driven animation (`scrollDuration`, `easeInOutCubic`):
 *    the row is highlighted at once and held for the whole scroll; wheel, touch or keys cancel it;
 *    on arrival the hash is set, focus moves to the section and its heading gets a short settle.
 *    Reduced motion, modified clicks or a missing target fall through to the plain anchor jump.
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

/** Eased scroll: 450 ms for short hops, growing with distance, never past 700 ms. */
export function scrollDuration(distance: number): number {
  const d = Math.abs(distance);
  return Math.round(450 + 250 * Math.min(1, d / 4000));
}

export function easeInOutCubic(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2;
}

const reducedMotion = (): boolean =>
  document.documentElement.dataset['motion'] === 'reduce' ||
  (typeof matchMedia === 'function' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches);

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

  // While an index click is scrolling, the clicked row stays current (no flicker through rows).
  let held = false;

  const resolve = () => {
    if (held) return;
    const atBottom =
      window.scrollY + window.innerHeight >= doc.scrollHeight - 2;
    if (atBottom) return setCurrent(links.length - 1);
    // Adjacent sections can both touch the line; the later one wins.
    const hit = Math.max(-1, ...inView);
    if (hit >= 0) return setCurrent(hit);
    // Nothing on the line: the garden and footer below contact have no row, so the last
    // section above the line stays current (contact), also after a reload inside the garden.
    if (current >= 0) return;
    let above = 0;
    targets.forEach((t, n) => {
      if (t && t.getBoundingClientRect().top <= window.innerHeight / 2)
        above = n;
    });
    setCurrent(above);
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

  // --- Eased scroll for row clicks -------------------------------------------------------
  let cancel: (() => void) | null = null;

  const targetTop = (el: HTMLElement): number => {
    const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
    const max = Math.max(0, doc.scrollHeight - window.innerHeight);
    return Math.min(
      max,
      Math.max(0, el.getBoundingClientRect().top + window.scrollY - margin),
    );
  };

  const arrive = (el: HTMLElement, hash: string) => {
    if (location.hash !== hash) history.pushState(null, '', hash);
    el.focus({ preventScroll: true });
    const heading = el.querySelector<HTMLElement>('.section-heading');
    if (heading) {
      heading.removeAttribute('data-arrive');
      void heading.offsetWidth; // restart the animation on a repeat click
      heading.setAttribute('data-arrive', '');
      window.setTimeout(() => heading.removeAttribute('data-arrive'), 300);
    }
  };

  const glide = (index: number, el: HTMLElement, hash: string) => {
    cancel?.();
    const from = window.scrollY;
    const to = targetTop(el);
    const distance = to - from;
    held = true;
    setCurrent(index);
    if (Math.abs(distance) < 2) {
      held = false;
      arrive(el, hash);
      resolve();
      return;
    }
    const duration = scrollDuration(distance);
    const start = performance.now();
    let raf = 0;
    const unhook = () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('wheel', stop);
      window.removeEventListener('touchstart', stop);
      window.removeEventListener('keydown', stop);
      cancel = null;
    };
    // The user took over (or a newer glide starts): hand the row back to the observers.
    const stop = () => {
      unhook();
      held = false;
      schedule();
    };
    const step = (now: number) => {
      const t = (now - start) / duration;
      window.scrollTo({
        // Re-read the target each frame: content above it can still settle while the glide runs.
        top: from + (targetTop(el) - from) * easeInOutCubic(t),
        behavior: 'instant',
      });
      if (t < 1) {
        raf = requestAnimationFrame(step);
        return;
      }
      unhook();
      arrive(el, hash);
      // The observers still hold crossings from mid-flight until they report this frame's
      // position. Keep the clicked row for two frames, then let them have it back.
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          held = false;
          resolve();
        }),
      );
    };
    // Any user input takes the wheel back; the observers then pick the row as usual.
    window.addEventListener('wheel', stop, { passive: true });
    window.addEventListener('touchstart', stop, { passive: true });
    window.addEventListener('keydown', stop);
    cancel = () => {
      stop();
    };
    raf = requestAnimationFrame(step);
  };

  nav.addEventListener('click', (e) => {
    if (
      e.defaultPrevented ||
      e.button !== 0 ||
      e.metaKey ||
      e.ctrlKey ||
      e.shiftKey ||
      e.altKey ||
      reducedMotion()
    )
      return;
    const link = (e.target as Element).closest<HTMLAnchorElement>(
      'a[href^="#"]',
    );
    const index = link ? links.indexOf(link) : -1;
    const el = index >= 0 ? targets[index] : null;
    if (!link || !el) return;
    e.preventDefault();
    glide(index, el, link.hash);
  });

  window.addEventListener('nihal:drag', (e) => {
    const detail = (e as CustomEvent<{ active?: boolean } | undefined>).detail;
    nav.toggleAttribute('data-dim', detail?.active === true);
  });
}
