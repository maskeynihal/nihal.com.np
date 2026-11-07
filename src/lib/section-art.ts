/**
 * Pointer behaviour of the section drawings (S1), loaded on the first pointer move.
 *  - Parallax: while the pointer is in the drawing's column, the drawing shifts a few px against
 *    it (a transform on `.art-par`, eased by CSS).
 *  - One small reaction per hover or click, with a cooldown: rack LEDs toggle, the branch dot
 *    starts over, the pen wiggles, the plane hops, the flags puff, the ladder restarts. Web
 *    Animations on `translate` / `rotate` only, so they compose with the CSS loops and stay on
 *    the compositor.
 * Off under reduced motion. Decoration: no text, nothing focusable.
 */

const COOLDOWN_MS = 900;
const SHIFT_PX = 6;

const reduced = (): boolean =>
  document.documentElement.dataset['motion'] === 'reduce' ||
  matchMedia('(prefers-reduced-motion: reduce)').matches;

const layer = (art: HTMLElement, cls: string): Element | null =>
  art.querySelector(`.${cls}`);

const wiggle = (
  el: Element | null,
  frames: Keyframe[],
  duration: number,
  easing = 'ease-in-out',
): void => {
  el?.animate(frames, { duration, easing });
};

const restart = (el: Element | null): void => {
  el?.getAnimations().forEach((a) => {
    a.currentTime = 0;
  });
};

const reactions: Record<string, (art: HTMLElement) => void> = {
  projects: (art) => {
    art.toggleAttribute('data-off');
  },
  opensource: (art) => restart(layer(art, 'art-walk')),
  cv: (art) => restart(layer(art, 'art-climb')),
  contact: (art) =>
    wiggle(
      layer(art, 'art-plane'),
      [
        { translate: '0 0', rotate: '0deg' },
        { translate: '4% -9%', rotate: '-5deg', offset: 0.4 },
        { translate: '0 0', rotate: '0deg' },
      ],
      900,
      'cubic-bezier(0.3, 0.7, 0.3, 1)',
    ),
  about: (art) =>
    wiggle(
      layer(art, 'art-flags'),
      [
        { rotate: '0deg' },
        { rotate: '3deg' },
        { rotate: '-2deg' },
        { rotate: '0deg' },
      ],
      1400,
    ),
  writing: (art) =>
    wiggle(
      layer(art, 'art-pen'),
      [
        { translate: '0 0' },
        { translate: '-3% 1.5%' },
        { translate: '1.5% -0.5%' },
        { translate: '0 0' },
      ],
      1000,
    ),
};

const clamp = (n: number): number => Math.max(-1, Math.min(1, n));

export function initSectionArt(arts: Iterable<HTMLElement>): void {
  const list = [...arts];
  const last = new WeakMap<HTMLElement, number>();

  const react = (art: HTMLElement) => {
    if (reduced()) return;
    const now = performance.now();
    if (now - (last.get(art) ?? -COOLDOWN_MS) < COOLDOWN_MS) return;
    last.set(art, now);
    reactions[art.dataset['art'] ?? '']?.(art);
  };

  for (const art of list) {
    art.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'touch') react(art);
    });
    art.addEventListener('click', () => react(art));
  }

  let frame = 0;
  let pointer: { x: number; y: number } | null = null;
  const tick = () => {
    frame = 0;
    for (const art of list) {
      const par = art.firstElementChild as HTMLElement | null;
      if (!par) continue;
      const box = art.getBoundingClientRect();
      const col = art.parentElement?.getBoundingClientRect();
      if (
        !pointer ||
        reduced() ||
        box.width === 0 ||
        !col ||
        pointer.y < col.top ||
        pointer.y > col.bottom ||
        Math.abs(pointer.x - (box.left + box.width / 2)) > box.width
      ) {
        par.style.transform = '';
        continue;
      }
      // -1..1 from the drawing's centre; the drawing leans away from the pointer.
      const nx = clamp((pointer.x - box.left - box.width / 2) / box.width);
      const ny = clamp((pointer.y - box.top - box.height / 2) / box.height);
      par.style.transform = `translate3d(${(-nx * SHIFT_PX).toFixed(1)}px, ${(-ny * SHIFT_PX).toFixed(1)}px, 0)`;
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
}
