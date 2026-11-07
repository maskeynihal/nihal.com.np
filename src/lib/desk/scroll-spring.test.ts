import { describe, expect, it } from 'vitest';
import {
  MAX_PX,
  SLIDE_SIGN,
  atRest,
  frameSpeed,
  rollAngle,
  scrollFeelFor,
  smoothSpeed,
  stepSpring,
  targetPx,
  type Spring,
} from './scroll-spring';

const HZ = 60;
const DT = 1 / HZ;

/**
 * Runs the whole chain at `hz`: raw page travel per frame -> smoothed speed -> target -> spring.
 * `travel(i)` is the page travel (px) in frame i.
 */
function drive(
  model: string,
  frames: number,
  travel: (i: number) => number,
  hz = HZ,
) {
  const dt = 1 / hz;
  const feel = scrollFeelFor(model);
  const s: Spring = { x: 0, v: 0 };
  let vel = 0;
  const xs: number[] = [];
  for (let i = 0; i < frames; i++) {
    vel = smoothSpeed(vel, frameSpeed(travel(i), dt), dt);
    stepSpring(s, targetPx(vel, feel), dt);
    xs.push(s.x);
  }
  return { s, xs, feel, vel };
}

const peak = (xs: number[]) => Math.max(...xs.map(Math.abs));
const signChanges = (xs: number[], eps = 1e-4) => {
  let n = 0;
  let prev = 0;
  for (const x of xs) {
    const sg = Math.abs(x) < eps ? 0 : Math.sign(x);
    if (sg !== 0 && prev !== 0 && sg !== prev) n++;
    if (sg !== 0) prev = sg;
  }
  return n;
};

describe('scroll nudge', () => {
  it('a faster scroll slides an object further', () => {
    // 40 px/frame = 2400 px/s; 10 px/frame = 600 px/s.
    const fast = peak(drive('pacman', 60, () => 40).xs);
    const slow = peak(drive('pacman', 60, () => 10).xs);
    expect(fast).toBeGreaterThan(slow * 2);
  });

  it('slides towards the viewer when the page scrolls down, away when it scrolls up', () => {
    const down = drive('ball-s', 40, () => 30).xs;
    const up = drive('ball-s', 40, () => -30).xs;
    expect(Math.sign(down[39]!)).toBe(SLIDE_SIGN);
    expect(Math.sign(up[39]!)).toBe(-SLIDE_SIGN);
  });

  it('lighter things slide more: balls, then pac-men and the ghost, then the laptop and board', () => {
    const p = (m: string) => peak(drive(m, 90, () => 50).xs);
    expect(p('ball-s')).toBeGreaterThan(p('pacman'));
    expect(p('ball-m')).toBeGreaterThan(p('pacman'));
    expect(p('pacman')).toBeCloseTo(p('ghost'), 6);
    expect(p('pacman')).toBeGreaterThan(p('laptop') * 3);
    expect(p('pacman')).toBeGreaterThan(p('arduino') * 3);
    expect(p('laptop')).toBeLessThan(1);
    expect(p('arduino')).toBeLessThan(1);
  });

  it('never exceeds about 6 px, at any speed', () => {
    for (const m of ['ball-s', 'pacman', 'clock', 'laptop'])
      for (const px of [20, 100, 400])
        expect(peak(drive(m, 240, () => px).xs)).toBeLessThanOrEqual(
          MAX_PX * 1.03,
        );
    expect(targetPx(1e9, scrollFeelFor('ball-s'))).toBeCloseTo(MAX_PX, 5);
  });

  it('ignores a jump of the page (a link, not a scroll)', () => {
    expect(frameSpeed(3000, DT)).toBe(0);
    expect(peak(drive('ball-s', 30, (i) => (i === 3 ? 3000 : 0)).xs)).toBe(0);
  });

  it('the spring is close to critical: at most one overshoot, and a small one', () => {
    const feel = scrollFeelFor('ball-s');
    const s: Spring = { x: 0, v: 0 };
    const xs: number[] = [];
    for (let i = 0; i < 240; i++) {
      stepSpring(s, 5, DT);
      xs.push(s.x - 5);
    }
    // Step response: overshoot is the most it goes past the target.
    expect(Math.max(...xs)).toBeLessThan(5 * 0.04);
    expect(feel.gain).toBeGreaterThan(0);
    // A scroll that starts and stops: push out, one return, at most one crossing of zero.
    const burst = drive('ball-s', 240, (i) => (i < 20 ? 40 : 0)).xs;
    expect(signChanges(burst)).toBeLessThanOrEqual(1);
    expect(peak(burst.slice(120))).toBeLessThan(0.5);
  });

  it('wheel steps do not read as jerks: the slide changes smoothly from frame to frame', () => {
    // A mouse wheel: a 100 px step every 4th frame (about 15 steps/s), nothing between.
    const { xs } = drive('ball-s', 120, (i) => (i % 4 === 0 ? 100 : 0));
    let worst = 0;
    for (let i = 1; i < xs.length; i++)
      worst = Math.max(worst, Math.abs(xs[i]! - xs[i - 1]!));
    // At most 0.6 px between frames at 60 Hz (the whole travel is 6 px).
    expect(worst).toBeLessThan(0.6);
    // No frame-to-frame reversal of direction while the steps keep coming.
    expect(signChanges(xs.slice(10, 70))).toBe(0);
  });

  it('gives the same motion at a slow frame rate (software GL, about 7 fps)', () => {
    const fast = drive('ball-s', 120, () => 20, 60);
    const slow = drive('ball-s', 14, () => 20 * (60 / 7), 7);
    expect(peak(slow.xs)).toBeGreaterThan(peak(fast.xs) * 0.5);
    expect(peak(slow.xs)).toBeLessThanOrEqual(MAX_PX * 1.05);
  });

  it('settles at exactly zero when the scroll stops: no drift', () => {
    const feel = scrollFeelFor('pacman');
    const s: Spring = { x: 0, v: 0 };
    let vel = 0;
    for (let i = 0; i < 40; i++) {
      vel = smoothSpeed(vel, frameSpeed(40, DT), DT);
      stepSpring(s, targetPx(vel, feel), DT);
    }
    let frames = 0;
    while (frames < 600) {
      vel = smoothSpeed(vel, 0, DT);
      if (Math.abs(vel) < 4) vel = 0;
      const target = targetPx(vel, feel);
      stepSpring(s, target, DT);
      frames++;
      if (atRest(s, target)) break;
    }
    expect(atRest(s, 0)).toBe(true);
    expect(frames).toBeLessThan(180);
    s.x = 0;
    s.v = 0;
    expect(Object.is(s.x, 0) && Object.is(s.v, 0)).toBe(true);
  });

  it('is stable at a long frame time', () => {
    const s: Spring = { x: 0, v: 0 };
    for (let i = 0; i < 100; i++) stepSpring(s, 4, 0.5);
    expect(Math.abs(s.x - 4)).toBeLessThan(0.05);
  });

  it('only a ball turns, and it rolls exactly the distance it slid', () => {
    const ball = scrollFeelFor('ball-s');
    expect(rollAngle(0.007, ball)).toBeCloseTo(0.007 / 0.035, 9);
    // Arc length on the ball's rim equals the slide.
    const d = 0.012;
    expect(rollAngle(d, scrollFeelFor('ball-l')) * 0.07).toBeCloseTo(d, 9);
    for (const m of [
      'pacman',
      'ghost',
      'clock',
      'calendar',
      'arduino',
      'laptop',
      'cruiser',
      'letter-n',
      'letter-a',
    ])
      expect(rollAngle(0.05, scrollFeelFor(m))).toBe(0);
    // An unknown model is treated as heavy and never turns.
    expect(rollAngle(0.05, scrollFeelFor('nope'))).toBe(0);
  });
});
