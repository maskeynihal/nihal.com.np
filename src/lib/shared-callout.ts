/**
 * Object-tap shared transition (design 5): the tapped object's callout label is the shared
 * element. A copy of it is placed in a fixed layer at the label's position and travels to the
 * target section's date line in 600 ms, tracking the line while the page scrolls under it, then
 * the copy is removed. It never scrolls anything (the `nihal:navigate` handler is the one
 * scroll owner) and is `aria-hidden`, so a screen reader never meets the text twice.
 */
export const FLIGHT_MS = 600;
export const CALLOUT_EVENT = 'nihal:callout';

export interface FlightLabel {
  /** The section id the tap is going to, as in `nihal:navigate`. */
  target: string;
  text: string;
  rect: { left: number; top: number; width: number; height: number };
}

const easeOut = (p: number): number => 1 - (1 - p) ** 3;

/** Position at progress `p` (0..1) between where the label was and where the line is now. Pure. */
export function flightAt(
  from: { left: number; top: number },
  to: { left: number; top: number },
  p: number,
): { left: number; top: number } {
  const e = easeOut(Math.min(1, Math.max(0, p)));
  return {
    left: from.left + (to.left - from.left) * e,
    top: from.top + (to.top - from.top) * e,
  };
}

/** The element the label lands on: the panel's date line, else the section heading, else the section. */
export function dateLineOf(section: HTMLElement): HTMLElement {
  return (
    section.querySelector<HTMLElement>('[data-date-line]') ??
    section.querySelector<HTMLElement>('h1, h2, h3') ??
    section
  );
}

let running: { stop: () => void } | null = null;

/** Starts the flight; resolves when the copy has been removed. A new flight ends the last one. */
export function flyLabel(label: FlightLabel, line: HTMLElement): Promise<void> {
  running?.stop();
  return new Promise((resolve) => {
    const layer = document.createElement('div');
    layer.setAttribute('aria-hidden', 'true');
    layer.dataset['calloutFlight'] = '';
    layer.className = 'callout-flight';
    const clone = document.createElement('span');
    clone.className = 'label callout-flight-label';
    clone.textContent = label.text;
    layer.appendChild(clone);
    document.body.appendChild(layer);

    const from = { left: label.rect.left, top: label.rect.top };
    const fromColor = getComputedStyle(line).color;
    const t0 = performance.now();
    let frame = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      cancelAnimationFrame(frame);
      layer.remove();
      if (running === handle) running = null;
      resolve();
    };
    const handle = { stop: finish };
    running = handle;

    const place = (p: number) => {
      const r = line.getBoundingClientRect();
      const at = flightAt(from, { left: r.left, top: r.top }, p);
      clone.style.transform = `translate(${Math.round(at.left)}px, ${Math.round(at.top)}px)`;
      clone.style.color = `color-mix(in srgb, white, ${fromColor} ${Math.round(p * 100)}%)`;
    };
    const step = (now: number) => {
      const p = (now - t0) / FLIGHT_MS;
      if (p >= 1) return finish();
      place(p);
      frame = requestAnimationFrame(step);
    };
    place(0);
    frame = requestAnimationFrame(step);
  });
}
