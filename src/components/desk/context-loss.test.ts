import { describe, expect, it, vi } from 'vitest';
import { RESTORE_WAIT_MS, createContextPolicy } from './context-loss';

function setup() {
  const events: string[] = [];
  const timers = new Map<number, { cb: () => void; ms: number }>();
  let next = 1;
  const policy = createContextPolicy(
    (e) => events.push(e),
    (cb, ms) => {
      timers.set(next, { cb, ms });
      return next++;
    },
    (t) => timers.delete(t as number),
  );
  return { events, timers, policy };
}

describe('context policy', () => {
  it('first loss pauses, a restore resumes', () => {
    const { events, timers, policy } = setup();
    policy.lost();
    expect(events).toEqual(['lost']);
    expect([...timers.values()][0]?.ms).toBe(RESTORE_WAIT_MS);
    policy.restored();
    expect(events).toEqual(['lost', 'restored']);
    expect(timers.size).toBe(0);
  });
  it('a second loss is final, and later restores are ignored', () => {
    const { events, policy } = setup();
    policy.lost();
    policy.restored();
    policy.lost();
    policy.restored();
    expect(events).toEqual(['lost', 'restored', 'permanent']);
  });
  it('a restore that never comes is final', () => {
    const { events, timers, policy } = setup();
    policy.lost();
    [...timers.values()][0]!.cb();
    expect(events).toEqual(['lost', 'permanent']);
    policy.restored();
    expect(events).toEqual(['lost', 'permanent']);
  });
  it('a restore with no loss is ignored', () => {
    const fn = vi.fn();
    createContextPolicy(fn).restored();
    expect(fn).not.toHaveBeenCalled();
  });
});
