import { describe, expect, it } from 'vitest';
import {
  HP_AUX_HOME,
  HP_LEAD_HOME,
  HP_OFF_END,
  HP_ON_END,
  HP_SEATED,
  HP_SET_DOWN,
  gripLocal,
  headToDesk,
  hpPlan,
  objPoint,
  type HeadCtx,
  type HpIn,
  type HpOut,
} from './headphones-anim';
import { HAND_OFFSET, HEAD_OFFSET, HEAD_R, neckAt, type V3 } from './rig';

const dist = (a: V3, b: V3) =>
  Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const head: HeadCtx = { lean: 0.05, pitch: 0.03, pos: [0.1, 0, -0.05], yaw: 0 };
const REST: V3 = [0.62, 0.041, -0.65];
const input = (t: number, on: boolean, rp: number): HpIn => ({
  t,
  on,
  rest: REST,
  restPitch: rp,
  head,
  leadFrom: [0.09, 0.07, -0.28],
  auxFrom: [-0.09, 0.07, -0.28],
  leadHome: HP_LEAD_HOME,
  auxHome: HP_AUX_HOME,
});
const FPS = 120;
function run(on: boolean, rp: number): { t: number; o: HpOut }[] {
  const end = on ? HP_ON_END : HP_OFF_END;
  const out: { t: number; o: HpOut }[] = [];
  for (let t = 0; t <= end; t += 1 / FPS)
    out.push({ t, o: hpPlan(input(t, on, rp)) });
  return out;
}
const poseOf = (o: HpOut): { b: V3; p: number } => {
  const bh = headToDesk(head, o.head);
  return {
    b: [
      o.desk[0] + (bh[0] - o.desk[0]) * o.k,
      o.desk[1] + (bh[1] - o.desk[1]) * o.k,
      o.desk[2] + (bh[2] - o.desk[2]) * o.k,
    ],
    p: o.deskPitch + (o.headPitch - o.deskPitch) * o.k,
  };
};
/** The hoop's band and the cups' rims, as points of the desk frame. */
function hoop(o: HpOut): { band: V3[]; cups: V3[] } {
  const { b, p } = poseOf(o);
  const band: V3[] = [];
  const cups: V3[] = [];
  for (let i = 0; i <= 16; i++) {
    const a = (i / 16) * Math.PI;
    band.push(
      objPoint(b, p, o.spread, [
        Math.cos(a) * 0.116,
        0.03805 + Math.sin(a) * 0.14,
        0,
      ]),
    );
  }
  for (const sg of [-1, 1])
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      for (const dx of [-0.016, 0.016])
        cups.push(
          objPoint(b, p, o.spread, [
            sg * 0.116 + dx,
            0.03805 + Math.cos(a) * 0.04,
            Math.sin(a) * 0.04,
          ]),
        );
    }
  return { band, cups };
}

describe.each([
  ['upright', 0],
  ['flat', Math.PI / 2],
])('headphones choreography (%s on the desk)', (_n, rp) => {
  it('is on the desk where it started at the first moment, and where it ends on the desk when taken off', () => {
    const a = hpPlan(input(0, true, rp));
    expect(a.desk).toEqual(REST);
    expect(a.deskPitch).toBeCloseTo(rp, 9);
    expect(a.spread).toBe(0);
    // set down: exactly the rest pose (the Scene snaps back to it with no jump)
    const d = hpPlan(input(HP_SET_DOWN, false, rp));
    expect(dist(d.desk, REST)).toBeLessThan(1e-9);
    expect(d.deskPitch).toBeCloseTo(rp, 9);
    expect(d.spread).toBe(0);
    expect(d.k).toBe(0);
  });

  it('seats the cups centred on the ears, upright, hands off', () => {
    const o = hpPlan(input(HP_SEATED + 0.3, true, rp));
    expect(o.worn).toBe(true);
    expect(o.k).toBe(1);
    expect(o.spread).toBe(0);
    expect(o.leadW).toBe(0);
    expect(o.auxW).toBe(0);
    expect(o.headPitch).toBeCloseTo(0, 9);
    o.head.forEach((v, i) => expect(v).toBeCloseTo([0, 0.066, 0.006][i]!, 9));
  });

  it('never puts the band or the cups through the head on the way over', () => {
    const c = headToDesk(head, [
      HEAD_OFFSET[0],
      HEAD_OFFSET[1],
      HEAD_OFFSET[2],
    ]);
    void neckAt;
    let worst = 9;
    for (const on of [true, false]) {
      for (const { t, o } of run(on, rp)) {
        if (!o.active) continue;
        const { band, cups } = hoop(o);
        // the band is 12 mm thick; the cups' rims are on the surface
        for (const q of band)
          worst = Math.min(worst, dist(q, c) - HEAD_R - 0.012);
        for (const q of cups) worst = Math.min(worst, dist(q, c) - HEAD_R);
        void t;
      }
    }
    // (touching when worn, and never inside)
    expect(worst).toBeGreaterThan(0.004);
  });

  it('keeps the hoop clear of the desk', () => {
    for (const on of [true, false])
      for (const { o } of run(on, rp)) {
        if (!o.active) continue;
        const { band, cups } = hoop(o);
        for (const q of [...band, ...cups])
          expect(q[1]).toBeGreaterThan(-0.005);
      }
  });

  it('moves smoothly: no jump in the object or the hands from one frame to the next', () => {
    for (const on of [true, false]) {
      const frames = run(on, rp);
      for (let i = 1; i < frames.length; i++) {
        const a = frames[i - 1]!.o;
        const b = frames[i]!.o;
        if (!(a.active && b.active)) continue;
        const pa = poseOf(a);
        const pb = poseOf(b);
        // metres per frame at 120 fps: 1.5 m/s is quick for headphones in a hand
        expect(dist(pa.b, pb.b) * FPS).toBeLessThan(2.2);
        expect(Math.abs(pa.p - pb.p) * FPS).toBeLessThan(6);
        expect(dist(a.lead, b.lead) * FPS).toBeLessThan(2.5);
        expect(dist(a.aux, b.aux) * FPS).toBeLessThan(2.5);
        expect(Math.abs(a.leadW - b.leadW) * FPS).toBeLessThan(14);
      }
    }
  });

  it('holds the grip points where the hands are, so the hands never lead or lag the hoop', () => {
    let locked = 0;
    for (const on of [true, false])
      for (const { o } of run(on, rp)) {
        if (o.leadW < 0.99) continue;
        const { b, p } = poseOf(o);
        const reg = o.leadReg;
        const band = gripLocal('band', 1, o.spread);
        const cup = gripLocal('cup', 1, o.spread);
        const g = objPoint(b, p, o.spread, [
          band[0] + (cup[0] - band[0]) * reg,
          band[1] + (cup[1] - band[1]) * reg,
          band[2] + (cup[2] - band[2]) * reg,
        ]);
        // the plan's wrist target is the grip less the hand's offset: within a few cm of the grip
        expect(
          dist(
            [
              o.lead[0] + HAND_OFFSET[0],
              o.lead[1] + HAND_OFFSET[1],
              o.lead[2] + HAND_OFFSET[2],
            ],
            g,
          ),
        ).toBeLessThan(0.002);
        locked += 1;
      }
    expect(locked).toBeGreaterThan(100);
  });

  it('takes about two seconds to put on and a bit under that to take off', () => {
    expect(HP_SEATED).toBeGreaterThanOrEqual(1.6);
    expect(HP_SEATED).toBeLessThanOrEqual(2.2);
    expect(HP_SET_DOWN).toBeGreaterThanOrEqual(1.3);
    expect(HP_SET_DOWN).toBeLessThanOrEqual(1.7);
    expect(HP_SET_DOWN).toBeLessThan(HP_SEATED);
  });
});
