/**
 * Wall-clock helpers shared by the title block (B-03) and the contact clocks (B-06a).
 * `Intl.DateTimeFormat` only; no zone tables. Kathmandu is UTC+5:45 with no DST, but the
 * zone is still resolved by name so the same code serves any city.
 */
export const KATHMANDU = 'Asia/Kathmandu';

/** "14:32" in the given IANA zone, 24 hour, zero padded. */
export function formatClock(date: Date, timeZone: string = KATHMANDU): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(date);
}

/** Milliseconds until the next minute boundary (at least 1, so a timer never spins). */
export function msToNextMinute(date: Date): number {
  return Math.max(1, 60_000 - (date.getTime() % 60_000));
}

/**
 * Calls `tick(now)` immediately and then on every minute boundary. Returns a stop function.
 * Re-syncs on `visibilitychange` because timers are throttled in background tabs.
 */
export function everyMinute(tick: (now: Date) => void): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const run = () => {
    clearTimeout(timer);
    const now = new Date();
    tick(now);
    timer = setTimeout(run, msToNextMinute(now));
  };
  const onVisible = () => {
    if (!document.hidden) run();
  };
  document.addEventListener('visibilitychange', onVisible);
  run();
  return () => {
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}
