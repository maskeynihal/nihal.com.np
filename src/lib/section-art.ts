/**
 * Pointer behaviour of the section art (S5), loaded on the first pointer move.
 *  - Light: while the pointer is over an art column, a soft round window, holding a brighter copy of
 *    the art, follows it. Both the window and the copy move with `transform` only.
 *  - Click: a ripple (two rings) spreads from the click point; on the server racks it also toggles
 *    the LEDs. Web Animations on `transform` / `opacity`, so it stays on the compositor.
 * The art takes no pointer events: the pointer is read from the document, so text and links under
 * or near it are never blocked. Off under reduced motion. Decoration: no text, nothing focusable.
 */

const HALF = 100; // half the spot window, px

const reduced = (): boolean =>
  document.documentElement.dataset['motion'] === 'reduce' ||
  matchMedia('(prefers-reduced-motion: reduce)').matches;

interface Spot {
  win: HTMLElement;
  lit: HTMLElement;
}

const makeSpot = (art: HTMLElement): Spot => {
  const win = document.createElement('div');
  win.className = 'art-spot';
  const lit = document.createElement('div');
  lit.className = 'art-lit';
  const top = art.querySelector('.art-top')?.cloneNode() as Element | null;
  const bot = art.querySelector('.art-bot')?.cloneNode() as Element | null;
  const body = document.createElement('div');
  body.className = 'art-body';
  const mid = art.querySelector('.art-mid')?.cloneNode();
  if (mid) body.append(mid);
  if (top) lit.append(top);
  lit.append(body);
  if (bot) lit.append(bot);
  win.append(lit);
  art.append(win);
  return { win, lit };
};

const ripple = (art: HTMLElement, x: number, y: number): void => {
  for (const delay of [0, 220]) {
    const r = document.createElement('div');
    r.className = 'art-ripple';
    r.style.left = `${x}px`;
    r.style.top = `${y}px`;
    art.append(r);
    const a = r.animate(
      [
        { opacity: 0.55, transform: 'scale(0.2)' },
        { opacity: 0, transform: 'scale(3.2)' },
      ],
      { duration: 1100, delay, easing: 'cubic-bezier(0.2, 0.7, 0.2, 1)' },
    );
    a.onfinish = () => r.remove();
  }
};

export function initSectionArt(arts: Iterable<HTMLElement>): void {
  const list = [...arts];
  const spots = new WeakMap<HTMLElement, Spot>();
  let frame = 0;
  let pointer: { x: number; y: number } | null = null;

  const tick = () => {
    frame = 0;
    for (const art of list) {
      const box = art.getBoundingClientRect();
      const inside =
        !!pointer &&
        !reduced() &&
        box.width > 0 &&
        pointer.x >= box.left &&
        pointer.x <= box.right &&
        pointer.y >= box.top &&
        pointer.y <= box.bottom;
      let spot = spots.get(art);
      if (!inside) {
        spot?.win.removeAttribute('data-on');
        continue;
      }
      if (!spot) {
        spot = makeSpot(art);
        spots.set(art, spot);
      }
      const x = pointer!.x - box.left - HALF;
      const y = pointer!.y - box.top - HALF;
      spot.lit.style.width = `${box.width}px`;
      spot.lit.style.height = `${box.height}px`;
      spot.win.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
      spot.lit.style.transform = `translate3d(${(-x).toFixed(1)}px, ${(-y).toFixed(1)}px, 0)`;
      spot.win.setAttribute('data-on', '');
    }
  };
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(tick);
  };

  addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType === 'touch') return;
      pointer = { x: e.clientX, y: e.clientY };
      schedule();
    },
    { passive: true },
  );
  document.documentElement.addEventListener('pointerleave', () => {
    pointer = null;
    schedule();
  });
  addEventListener(
    'click',
    (e) => {
      if (reduced()) return;
      for (const art of list) {
        const box = art.getBoundingClientRect();
        if (
          e.clientX < box.left ||
          e.clientX > box.right ||
          e.clientY < box.top ||
          e.clientY > box.bottom
        )
          continue;
        ripple(art, e.clientX - box.left, e.clientY - box.top);
        if (art.dataset['art'] === 'projects') art.toggleAttribute('data-off');
      }
    },
    { passive: true },
  );
}
