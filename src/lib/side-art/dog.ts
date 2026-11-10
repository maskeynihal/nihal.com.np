/** Dog on a walk (section art). A dog (the garden's dog, redrawn) follows the page down a winding path and fetches on a click. */
import {
  E,
  g,
  SA,
  PG,
  ink,
  fillS,
  fillP,
  PL,
  circ,
  glow,
  clamp,
  lerp,
  sm,
  mulberry,
  TAU,
  PI,
} from './core';
import type { Col, Pt, Scene, State } from './core';

/**
 * The dog's largest extent in its own units (multiplied by the draw scale): the longest reach of nose
 * (head lowered, ball in the mouth) or tail to either side, the tallest pose (head up, carrying), and
 * the ball's radius. The path, the dog and the ball are confined to the safe rect with these.
 */
export const DOG_REACH_X = 72;
export const DOG_REACH_UP = 80;
export const BALL_R = 9;

const DG = {
  /**
   * The garden's retriever (src/lib/garden/dogs.ts), same outline, head, ear and jointed legs, at the
   * art's quiet strength. Origin: the ground under the body, facing +x. `low` is the head down for a
   * sniff, `up` the head lifted to carry, `sit` the sitting pose.
   */
  dog(
    sc: number,
    ph: number,
    moving: number,
    low: number,
    up: number,
    tailW: number,
    pant: boolean,
    t: number,
    ball: boolean,
    sit: boolean,
  ): void {
    const lw = 1.1 / sc,
      L = 32,
      T = -(L + 14),
      B = T + 23 * 0.95,
      Bt = B - 5,
      S = 1.05,
      M = 13.5;
    const bob = moving > 0.05 ? Math.abs(Math.sin(ph)) * 1.2 * moving : 0;
    const ik = (a: Pt, b: Pt, l1: number, l2: number, bend: number): Pt => {
      const dx = b[0] - a[0],
        dy = b[1] - a[1],
        dl = Math.hypot(dx, dy) || 1,
        d = clamp(dl, Math.abs(l1 - l2) + 0.01, l1 + l2 - 0.01),
        ux = dx / dl,
        uy = dy / dl,
        al = (l1 * l1 - l2 * l2 + d * d) / (2 * d),
        off = Math.sqrt(Math.max(0, l1 * l1 - al * al)),
        mx = a[0] + ux * al,
        my = a[1] + uy * al,
        k1: Pt = [mx - uy * off, my + ux * off],
        k2: Pt = [mx + uy * off, my - ux * off];
      return (k1[0] - k2[0]) * bend > 0 ? k1 : k2;
    };
    const limb = (pts: Pt[], ws: number[], o: number, out = 1) => {
      g.lineCap = 'round';
      const seg = (i: number, w: number) => {
        g.lineWidth = w;
        g.beginPath();
        g.moveTo(pts[i]![0], pts[i]![1]);
        g.lineTo(pts[i + 1]![0], pts[i + 1]![1]);
        g.stroke();
      };
      g.strokeStyle = SA(0.95 * out);
      for (let i = 0; i < pts.length - 1; i++) seg(i, ws[i]! + o * 2);
      g.strokeStyle = PG(1);
      for (let i = 0; i < pts.length - 1; i++) seg(i, ws[i]!);
    };
    const foot = (p: number, front: boolean, off: number): Pt => {
      const u = (((p / TAU) % 1) + 1) % 1,
        stance = 0.62,
        stride = 8,
        lift = 3.5;
      let fx: number,
        fy = 0;
      if (u < stance) fx = stride * (1 - (2 * u) / stance);
      else {
        const k = (u - stance) / (1 - stance);
        fx = -stride + 2 * stride * k;
        fy = -Math.sin(PI * k) * lift;
      }
      return [
        (front ? 18 : -15) + fx * moving + off * (1 - moving),
        fy * moving,
      ];
    };
    const leg = (front: boolean, p: number, far: boolean) => {
      const f = foot(p, front, front ? (far ? 5 : -2) : far ? -5 : 3),
        wf = front ? 7.15 : 7.2;
      let pts: Pt[], ws: number[];
      if (front) {
        const hip: Pt = [18, B - 8 + bob * 0.4],
          wrist: Pt = [f[0] + 1, f[1] - 9],
          el = ik(hip, wrist, 13, 14, -1);
        pts = [hip, el, wrist, [f[0] + 0.5, f[1] - 2.5]];
        ws = [wf, wf * 0.7, wf * 0.58];
      } else {
        const hip: Pt = [-15, B - 8 + bob * 0.4],
          hock: Pt = [f[0] - 4, f[1] - 12],
          st = ik(hip, hock, 12, 15, 1);
        pts = [hip, st, hock, [f[0] - 1, f[1] - 2.5]];
        ws = [wf * 1.1, wf * 0.66, wf * 0.56];
      }
      limb(pts, ws, lw, far ? 0.5 : 1);
      g.globalAlpha = far ? 0.5 : 1;
      g.lineWidth = lw;
      g.strokeStyle = SA(0.95);
      g.fillStyle = PG(1);
      g.beginPath();
      g.ellipse(f[0] + 2, f[1] - 1.8, 4.4, 2.4, 0, 0, TAU);
      g.fill();
      g.stroke();
      g.globalAlpha = 1;
    };
    const head = (hx: number, hy: number, hr: number): void => {
      // head frame: origin the skull, +x toward the nose
      const x0 = 8.3 * S,
        x1 = x0 + M,
        px = x0 - 1,
        py = 4.4 * S,
        len = x1 - px,
        open = ball ? 0.2 : pant ? 0.3 : 0,
        tongue = !ball && pant ? 0.55 : 0;
      g.save();
      g.translate(hx, hy);
      g.rotate(hr);
      g.lineWidth = lw;
      g.fillStyle = PG(1);
      g.strokeStyle = SA(0.95);
      g.save();
      g.translate(px, py);
      g.rotate(open);
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(len - 2, -1.3);
      g.bezierCurveTo(len + 0.4, -1.1, len + 0.4, 2.2, len - 2.4, 2.6);
      g.bezierCurveTo(len - 8, 3, 5, 3.2 * S, -2, 1.6 * S);
      g.closePath();
      g.fill();
      g.stroke();
      if (tongue > 0) {
        g.beginPath();
        g.moveTo(len - 12, -0.2);
        g.bezierCurveTo(
          len - 12,
          3.5 + tongue * 5,
          len - 5.5,
          4 + tongue * 5,
          len - 6,
          -0.2,
        );
        g.fill();
        g.stroke();
      }
      g.restore();
      g.beginPath();
      g.moveTo(-8.6 * S, 1.5 * S);
      g.bezierCurveTo(-9.4 * S, -6 * S, -4 * S, -10.4 * S, 2 * S, -9.8 * S);
      g.bezierCurveTo(5 * S, -9.5 * S, 7.8 * S, -8.8 * S, 8.4 * S, -5.4 * S);
      g.bezierCurveTo(
        x0 + M * 0.25,
        -6 * S,
        x1 - M * 0.35,
        -5.2,
        x1 - 1.2,
        -4.6,
      );
      g.bezierCurveTo(x1 + 1.6, -4.8, x1 + 2.6, -2.2, x1 + 1.9, 0.6);
      g.bezierCurveTo(x1 + 1.6, 2, x1 - 0.6, 2.9, x1 - 2.6, 2.8);
      g.lineTo(x0 + 3, 3.7);
      g.lineTo(px, py);
      g.bezierCurveTo(x0 - 5, 6.4 * S, 0, 9.6 * S, -5 * S, 8 * S);
      g.bezierCurveTo(-8 * S, 6 * S, -8.6 * S, 3.6 * S, -8.6 * S, 1.5 * S);
      g.closePath();
      g.fill();
      g.stroke();
      g.beginPath();
      g.moveTo(x1 - 2.4, -4.9);
      g.bezierCurveTo(x1 + 1.4, -5.6, x1 + 3.3, -3, x1 + 2.6, -0.2);
      g.bezierCurveTo(x1 + 2.2, 1.2, x1 - 0.2, 0.6, x1 - 2, -1.2);
      g.closePath();
      g.fillStyle = SA(0.95);
      g.fill();
      g.fillStyle = PG(1);
      g.beginPath();
      g.moveTo(px, py);
      g.quadraticCurveTo(px - 1.2, py - 2.4, px - 3, py - 2.6);
      g.stroke();
      g.beginPath();
      g.arc(4.4 * S, -3.4 * S, 1.5, 0, TAU);
      g.fillStyle = SA(0.95);
      g.fill();
      g.fillStyle = PG(1);
      g.beginPath();
      g.moveTo(2.6 * S, -6 * S);
      g.quadraticCurveTo(4.8 * S, -7 * S, 6.6 * S, -6 * S);
      g.stroke();
      g.save();
      g.translate(-0.8 * S, -5.6 * S);
      g.rotate(0.12 + Math.sin(t * 1.2) * 0.03 + low * 0.25 - hr * 0.85);
      g.beginPath();
      g.moveTo(-3.4 * S, 0);
      g.bezierCurveTo(-11 * S, 1 * S, -11.5 * S, 10 * S, -6.5 * S, 14.5 * S);
      g.bezierCurveTo(-2 * S, 16.5 * S, 3.2 * S, 11 * S, 3.6 * S, 0.4 * S);
      g.bezierCurveTo(2 * S, -1.5 * S, -1 * S, -1.8 * S, -3.4 * S, 0);
      g.closePath();
      g.fill();
      g.stroke();
      g.restore();
      if (ball) {
        g.beginPath();
        g.arc(x1 - 1, 3.5, 5, 0, TAU);
        g.fillStyle = PG(1);
        g.fill();
        g.strokeStyle = SA(1);
        g.lineWidth = lw;
        g.stroke();
      }
      g.restore();
    };
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = lw;
    if (!sit) {
      const phs = [ph + PI, ph, ph, ph + PI];
      leg(true, phs[0]!, true);
      leg(false, phs[1]!, true);
      this.tail(T, bob, tailW, t, lw, false);
      this.body(T, B, Bt, bob, low, up, lw, head, 0);
      leg(true, phs[2]!, false);
      leg(false, phs[3]!, false);
    } else {
      // sitting: the body tips back on its haunch, front legs straight, tail along the ground
      g.save();
      g.globalAlpha = 0.5;
      limb(
        [
          [18, -34],
          [18, -17],
          [18, -3],
          [18.5, -2.5],
        ],
        [6.4, 5, 4],
        lw,
        0.5,
      );
      g.restore();
      this.tail(T, 0, tailW, t, lw, true);
      g.save();
      g.translate(1, -3);
      g.rotate(-0.55);
      g.translate(15, 21);
      this.body(T, B, Bt, 0, 0, 0, lw, head, 0.5);
      g.restore();
      g.beginPath();
      g.ellipse(-6, -12, 14, 11, -0.15, 0, TAU);
      g.fillStyle = PG(1);
      g.fill();
      g.strokeStyle = SA(0.95);
      g.lineWidth = lw;
      g.stroke();
      g.beginPath();
      g.ellipse(8, -2.4, 9, 2.6, 0, 0, TAU);
      g.fill();
      g.stroke();
      limb(
        [
          [26, -34],
          [26, -17],
          [26, -3],
          [26.5, -2.5],
        ],
        [7, 5.4, 4.4],
        lw,
        1,
      );
      g.beginPath();
      g.ellipse(28, -1.8, 4.6, 2.4, 0, 0, TAU);
      g.fillStyle = PG(1);
      g.fill();
      g.strokeStyle = SA(0.95);
      g.lineWidth = lw;
      g.stroke();
    }
    g.restore();
  },
  tail(
    T: number,
    bob: number,
    tailW: number,
    t: number,
    lw: number,
    sit: boolean,
  ): void {
    const wag = Math.sin(t * (tailW > 0.5 ? 3 : 1.6)) * tailW * 0.22;
    if (sit) {
      g.beginPath();
      g.moveTo(-18, -8);
      g.quadraticCurveTo(-32, -3, -44, -6 - Math.abs(wag) * 30);
      g.strokeStyle = SA(0.95);
      g.lineWidth = 4;
      g.stroke();
      g.strokeStyle = PG(1);
      g.lineWidth = 2.4;
      g.stroke();
      return;
    }
    const ang = 0.6 + wag,
      tl = 30,
      tx = -23,
      ty = T + 6 + bob,
      tip: Pt = [tx - Math.cos(ang) * tl, ty - Math.sin(ang) * tl],
      mid: Pt = [
        tx - Math.cos(ang - 0.35) * tl * 0.55,
        ty - Math.sin(ang - 0.35) * tl * 0.55 + 5,
      ],
      ws = [6, 5.6, 5, 4.4, 3.6, 2.6],
      pts: Pt[] = [];
    for (let i = 0; i <= 6; i++) {
      const u = i / 6;
      pts.push([
        (1 - u) * (1 - u) * tx + 2 * (1 - u) * u * mid[0] + u * u * tip[0],
        (1 - u) * (1 - u) * ty + 2 * (1 - u) * u * mid[1] + u * u * tip[1],
      ]);
    }
    g.lineCap = 'round';
    g.strokeStyle = SA(0.95);
    for (let i = 0; i < 6; i++) {
      g.lineWidth = ws[i]! + lw * 2;
      g.beginPath();
      g.moveTo(pts[i]![0], pts[i]![1]);
      g.lineTo(pts[i + 1]![0], pts[i + 1]![1]);
      g.stroke();
    }
    g.strokeStyle = PG(1);
    for (let i = 0; i < 6; i++) {
      g.lineWidth = ws[i]!;
      g.beginPath();
      g.moveTo(pts[i]![0], pts[i]![1]);
      g.lineTo(pts[i + 1]![0], pts[i + 1]![1]);
      g.stroke();
    }
  },
  body(
    T: number,
    B: number,
    Bt: number,
    bob: number,
    low: number,
    up: number,
    lw: number,
    head: (hx: number, hy: number, hr: number) => void,
    rx: number,
  ): void {
    // head pose in dog space (garden headPose, quiet): lowered for a sniff, lifted to carry
    const hx = 36 + low * 7 - up,
      hy = T - 10 + bob * 0.6 + low * 30 - up * 6,
      hr = low * 0.95 - up * 0.2 + rx;
    const cr = Math.cos(hr),
      sr = Math.sin(hr),
      H = (u: number, v: number): Pt => [
        hx + u * cr - v * sr,
        hy + u * sr + v * cr,
      ],
      S = 1.05,
      cx = 28;
    const nape = H(-6.5 * S, -6 * S),
      throat = H(-3 * S, 8.4 * S);
    g.beginPath();
    g.moveTo(-25, T + 11 + bob);
    g.bezierCurveTo(-24, T + 2 + bob, -12, T - 1 + bob, 0, T + bob);
    g.bezierCurveTo(8, T + 0.5 + bob, 14, T - 0.5 + bob, 19, T - 1.5 + bob);
    g.bezierCurveTo(
      24,
      T - 2.5 + bob,
      nape[0] - 8,
      nape[1] + 5,
      nape[0],
      nape[1],
    );
    g.lineTo(throat[0] + 2, throat[1] - 2);
    g.bezierCurveTo(
      throat[0] + 1,
      throat[1] + 8,
      cx + 5,
      B - 14 * 0.95,
      cx + 1,
      B - 6,
    );
    g.bezierCurveTo(cx - 1, B - 1, 22, B + 1, 16, B + 1);
    g.bezierCurveTo(8, B + 1, 2, Bt, -7, Bt + bob);
    g.bezierCurveTo(-11, Bt + 1 + bob, -11, B + 3 + bob, -15, B + 3 + bob);
    g.bezierCurveTo(-24, B + 2 + bob, -27, T + 22 + bob, -25, T + 11 + bob);
    g.closePath();
    g.fillStyle = PG(1);
    g.fill();
    g.strokeStyle = SA(0.95);
    g.lineWidth = lw;
    g.stroke();
    g.globalAlpha = 0.6;
    g.beginPath();
    g.moveTo(14, T + 3 + bob);
    g.quadraticCurveTo(22, T + 11 + bob, 18, B - 5 + bob);
    g.moveTo(-5, T + 5 + bob);
    g.quadraticCurveTo(-17, T + 11 + bob, -13, Bt + bob);
    g.stroke();
    g.globalAlpha = 1;
    head(hx, hy, hr);
  },
  paw(x: number, y: number, a: number, al: number): void {
    g.save();
    g.translate(x, y);
    g.rotate(a);
    g.beginPath();
    g.ellipse(0, 0, 3.2, 2.6, 0, 0, TAU);
    ink(al, 1.3);
    for (const [dx, dy] of [
      [-4, -3],
      [-1, -5],
      [3, -4],
    ] as Pt[]) {
      g.beginPath();
      g.arc(dx + 3, dy, 1.1, 0, TAU);
      ink(al, 1.1);
    }
    g.restore();
  },
  ball(x: number, y: number, r = 5.5): void {
    circ(x, y, r);
    fillP();
    ink(1, 1.7);
    g.beginPath();
    g.arc(x, y, r * 0.72, PI * 0.15, PI * 0.85);
    g.arc(x, y, r * 0.72, PI * 1.15, PI * 1.85);
    ink(0.7, 1.1);
  },
  tree(x: number, y: number, sz: number, t: number): void {
    g.beginPath();
    g.moveTo(x - 3 * sz, y);
    g.lineTo(x - 2 * sz, y - 26 * sz);
    g.moveTo(x + 3 * sz, y);
    g.lineTo(x + 2 * sz, y - 26 * sz);
    ink(0.9, 1.8);
    const sw = Math.sin(t * 1.1 + x) * 1.5;
    for (const [dx, dy, r] of [
      [0, -44, 17],
      [-13, -34, 13],
      [13, -35, 13],
      [0, -30, 12],
    ] as [number, number, number][]) {
      g.beginPath();
      g.arc(x + dx * sz + sw * (1 + dy / -40), y + dy * sz, r * sz, 0, TAU);
      fillP();
      ink(0.88, 1.7);
    }
    g.beginPath();
    for (let i = 0; i < 5; i++) {
      g.moveTo(x - 12 * sz + i * 6 * sz, y - 42 * sz);
      g.lineTo(x - 16 * sz + i * 6 * sz, y - 32 * sz);
    }
    ink(0.35, 1.1);
  },
  sign(x: number, y: number, sz: number, txt: string): void {
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x, y - 50 * sz);
    ink(0.95, 2);
    g.beginPath();
    PL(
      [
        [x - 6 * sz, y - 48 * sz],
        [x + 34 * sz, y - 48 * sz],
        [x + 42 * sz, y - 41 * sz],
        [x + 34 * sz, y - 34 * sz],
        [x - 6 * sz, y - 34 * sz],
      ],
      5,
      0.5,
      true,
    );
    fillP();
    ink(0.95, 1.7);
    g.font = `${9 * sz}px ui-monospace,Menlo,monospace`;
    g.textAlign = 'left';
    g.fillStyle = SA(0.95);
    g.fillText(txt, x - 2 * sz, y - 38 * sz);
    g.beginPath();
    PL(
      [
        [x + 6 * sz, y - 30 * sz],
        [x - 30 * sz, y - 30 * sz],
        [x - 36 * sz, y - 24 * sz],
        [x - 30 * sz, y - 18 * sz],
        [x + 6 * sz, y - 18 * sz],
      ],
      6,
      0.5,
      true,
    );
    fillP();
    ink(0.95, 1.7);
  },
  pond(x: number, y: number, sz: number, t: number): void {
    for (let i = 0; i < 2; i++) {
      g.beginPath();
      g.ellipse(x, y, (44 - i * 14) * sz, (11 - i * 3) * sz, 0, 0, TAU);
      ink(0.85 - i * 0.2, 1.6);
    }
    for (let i = 0; i < 2; i++) {
      const r = (t * 10 + i * 14) % 26;
      g.beginPath();
      g.ellipse(x + 8 * sz, y, r * sz, r * 0.25 * sz, 0, 0, TAU);
      ink(Math.max(0, 0.6 - (r / 26) * 0.6), 1.2);
    }
    for (const dx of [-50, -44, 50]) {
      g.beginPath();
      g.moveTo(x + dx * sz, y + 2);
      g.quadraticCurveTo(
        x + (dx + 2) * sz,
        y - 14 * sz,
        x + (dx + (dx > 0 ? 4 : -3)) * sz,
        y - 26 * sz,
      );
      ink(0.8, 1.5);
      g.beginPath();
      g.ellipse(
        x + (dx + (dx > 0 ? 4 : -3)) * sz,
        y - 27 * sz,
        2.4 * sz,
        5 * sz,
        0.1,
        0,
        TAU,
      );
      fillS(0.7);
    }
  },
  lamp(x: number, y: number, sz: number, gw: number): void {
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x, y - 64 * sz);
    ink(0.95, 2.2);
    g.beginPath();
    g.moveTo(x - 9 * sz, y - 64 * sz);
    g.lineTo(x + 9 * sz, y - 64 * sz);
    g.lineTo(x + 6 * sz, y - 74 * sz);
    g.lineTo(x - 6 * sz, y - 74 * sz);
    g.closePath();
    fillP();
    ink(0.95, 1.8);
    g.beginPath();
    g.moveTo(x - 5 * sz, y);
    g.lineTo(x + 5 * sz, y);
    ink(0.9, 2);
    if (gw > 0.02) {
      glow(x, y - 62 * sz, 60 * sz, 0.42 * gw);
      g.beginPath();
      g.moveTo(x - 4 * sz, y - 62 * sz);
      g.lineTo(x - 16 * sz, y - 40 * sz);
      g.moveTo(x + 4 * sz, y - 62 * sz);
      g.lineTo(x + 16 * sz, y - 40 * sz);
      ink(0.5 * gw, 1.2);
    }
  },
  rock(x: number, y: number, sz: number): void {
    g.beginPath();
    PL(
      [
        [x - 22 * sz, y],
        [x - 18 * sz, y - 12 * sz],
        [x - 6 * sz, y - 19 * sz],
        [x + 8 * sz, y - 16 * sz],
        [x + 20 * sz, y - 6 * sz],
        [x + 22 * sz, y],
      ],
      8,
      0.8,
      true,
    );
    fillP();
    ink(0.9, 1.8);
    g.beginPath();
    g.moveTo(x - 8 * sz, y - 12 * sz);
    g.lineTo(x - 2 * sz, y - 6 * sz);
    g.moveTo(x + 4 * sz, y - 12 * sz);
    g.lineTo(x + 10 * sz, y - 5 * sz);
    ink(0.4, 1.1);
  },
  fence(x: number, y: number, sz: number): void {
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(x + i * 13 * sz, y);
      g.lineTo(x + i * 13 * sz, y - 26 * sz);
      g.lineTo(x + i * 13 * sz + 3 * sz, y - 30 * sz);
      g.lineTo(x + i * 13 * sz + 6 * sz, y - 26 * sz);
      g.lineTo(x + i * 13 * sz + 6 * sz, y);
      ink(0.85, 1.6);
    }
    g.beginPath();
    g.moveTo(x, y - 20 * sz);
    g.lineTo(x + 58 * sz, y - 20 * sz);
    g.moveTo(x, y - 10 * sz);
    g.lineTo(x + 58 * sz, y - 10 * sz);
    ink(0.8, 1.5);
  },
  flowers(x: number, y: number, sz: number, t: number): void {
    for (let i = 0; i < 3; i++) {
      const fx = x + (i - 1) * 14 * sz,
        fh = (22 + i * 5) * sz,
        sw = Math.sin(t * 1.5 + i) * 2;
      g.beginPath();
      g.moveTo(fx, y);
      g.quadraticCurveTo(fx + sw * 0.5, y - fh * 0.5, fx + sw, y - fh);
      ink(0.85, 1.5);
      for (let k = 0; k < 6; k++) {
        const a = (k * TAU) / 6;
        g.beginPath();
        g.ellipse(
          fx + sw + Math.cos(a) * 5 * sz,
          y - fh + Math.sin(a) * 5 * sz,
          4 * sz,
          2.2 * sz,
          a,
          0,
          TAU,
        );
        fillP();
        ink(0.9, 1.3);
      }
      circ(fx + sw, y - fh, 2.4 * sz);
      fillS(0.8);
    }
  },
  chai(x: number, y: number, sz: number, t: number): void {
    g.beginPath();
    g.rect(x - 26 * sz, y - 34 * sz, 52 * sz, 34 * sz);
    fillP();
    ink(0.9, 1.7);
    g.beginPath();
    PL(
      [
        [x - 32 * sz, y - 34 * sz],
        [x - 24 * sz, y - 48 * sz],
        [x + 24 * sz, y - 48 * sz],
        [x + 32 * sz, y - 34 * sz],
      ],
      4,
      0.5,
      true,
    );
    fillP();
    ink(0.95, 1.8);
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(x - 28 * sz + i * 14 * sz, y - 48 * sz);
      g.lineTo(x - 30 * sz + i * 15 * sz, y - 34 * sz);
      ink(0.4, 1);
    }
    g.beginPath();
    g.rect(x - 10 * sz, y - 24 * sz, 20 * sz, 14 * sz);
    ink(0.8, 1.4);
    g.beginPath();
    g.rect(x + 12 * sz, y - 22 * sz, 8 * sz, 12 * sz);
    ink(0.7, 1.2);
    g.font = `${8 * sz}px ui-monospace,Menlo,monospace`;
    g.textAlign = 'center';
    g.fillStyle = SA(0.95);
    g.fillText('chai', x, y - 37 * sz);
    for (let i = 0; i < 2; i++) {
      g.beginPath();
      g.moveTo(x - 4 * sz + i * 8 * sz, y - 26 * sz);
      g.bezierCurveTo(
        x - 8 * sz + i * 8 * sz,
        y - 34 * sz + Math.sin(t * 3 + i) * 2,
        x + i * 8 * sz,
        y - 40 * sz,
        x - 3 * sz + i * 8 * sz,
        y - 48 * sz,
      );
      ink(0.4, 1.1);
    }
  },
  wheel(x: number, y: number, sz: number): void {
    g.beginPath();
    g.moveTo(x - 12 * sz, y);
    g.lineTo(x - 12 * sz, y - 34 * sz);
    g.moveTo(x + 12 * sz, y);
    g.lineTo(x + 12 * sz, y - 34 * sz);
    ink(0.9, 1.8);
    g.beginPath();
    g.rect(x - 10 * sz, y - 32 * sz, 20 * sz, 22 * sz);
    fillP();
    ink(0.95, 1.8);
    for (let i = 0; i < 3; i++) {
      g.beginPath();
      g.moveTo(x - 8 * sz, y - 28 * sz + i * 6 * sz);
      g.lineTo(x + 8 * sz, y - 28 * sz + i * 6 * sz);
      ink(0.5, 1.1);
    }
    g.beginPath();
    g.moveTo(x - 6 * sz, y - 34 * sz);
    g.lineTo(x, y - 44 * sz);
    g.lineTo(x + 6 * sz, y - 34 * sz);
    ink(0.9, 1.5);
  },
  bench(x: number, y: number, sz: number): void {
    g.beginPath();
    g.moveTo(x - 28 * sz, y - 18 * sz);
    g.lineTo(x + 28 * sz, y - 18 * sz);
    g.moveTo(x - 28 * sz, y - 26 * sz);
    g.lineTo(x + 28 * sz, y - 26 * sz);
    g.moveTo(x - 24 * sz, y - 18 * sz);
    g.lineTo(x - 24 * sz, y);
    g.moveTo(x + 24 * sz, y - 18 * sz);
    g.lineTo(x + 24 * sz, y);
    g.moveTo(x - 26 * sz, y - 34 * sz);
    g.lineTo(x - 26 * sz, y - 18 * sz);
    g.moveTo(x + 26 * sz, y - 34 * sz);
    g.lineTo(x + 26 * sz, y - 18 * sz);
    ink(0.9, 2);
    g.beginPath();
    g.moveTo(x - 28 * sz, y - 34 * sz);
    g.lineTo(x + 28 * sz, y - 34 * sz);
    ink(0.9, 2);
  },
  mailbox(x: number, y: number, sz: number): void {
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x, y - 34 * sz);
    ink(0.95, 2);
    g.beginPath();
    PL(
      [
        [x - 14 * sz, y - 34 * sz],
        [x - 14 * sz, y - 48 * sz],
        [x + 12 * sz, y - 48 * sz],
        [x + 14 * sz, y - 34 * sz],
      ],
      3,
      0.5,
      true,
    );
    fillP();
    ink(0.95, 1.8);
    g.beginPath();
    g.moveTo(x + 12 * sz, y - 46 * sz);
    g.lineTo(x + 12 * sz, y - 56 * sz);
    g.lineTo(x + 20 * sz, y - 56 * sz);
    ink(0.9, 1.6);
  },
  hydrant(x: number, y: number, sz: number): void {
    g.beginPath();
    PL(
      [
        [x - 8 * sz, y],
        [x - 8 * sz, y - 22 * sz],
        [x - 11 * sz, y - 26 * sz],
        [x - 6 * sz, y - 34 * sz],
        [x + 6 * sz, y - 34 * sz],
        [x + 11 * sz, y - 26 * sz],
        [x + 8 * sz, y - 22 * sz],
        [x + 8 * sz, y],
      ],
      3,
      0.5,
      true,
    );
    fillP();
    ink(0.95, 1.8);
    g.beginPath();
    g.moveTo(x - 12 * sz, y - 18 * sz);
    g.lineTo(x + 12 * sz, y - 18 * sz);
    ink(0.8, 1.5);
  },
};
const pathAt = (s: State, d: number): Pt => {
  const ls = s.ls;
  let lo = 0,
    hi = ls.length - 1;
  d = clamp(d, 0, s.L);
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (ls[m] < d) lo = m;
    else hi = m;
  }
  const t = (d - ls[lo]) / (ls[hi] - ls[lo] || 1);
  return [lerp(s.px[lo], s.px[hi], t), lerp(s.py[lo], s.py[hi], t)];
};
export const dog: Scene = {
  init(c: Col): State {
    const w = c.w,
      h = c.h,
      rg = mulberry(c.seed * 29 + 13),
      u = clamp(w / 540, 0.8, 1.1),
      ph = rg() * 3,
      sc = u * 1.3;
    // The dog's real extent (head, tail, nose, ears, a lowered head) sets how close to an edge it may go:
    // about 64 units either side of the body and 74 above the feet.
    const halfW = Math.round(DOG_REACH_X * sc) + 4,
      top = Math.round(DOG_REACH_UP * sc) + 4,
      y0 = top + 2,
      y1 = h - 30;
    const A = Math.max(20, Math.min(w * 0.27, w / 2 - halfW - 4));
    const P = 380;
    const px: number[] = [],
      py: number[] = [],
      ls: number[] = [0];
    for (let y = y0; y <= y1; y += 6) {
      const x =
        w * 0.5 +
        (A / 1.15) *
          (Math.sin(((y - y0) / P) * TAU + ph) +
            0.15 * Math.sin(((y - y0) / P) * TAU * 2.2));
      px.push(x);
      py.push(y);
      if (px.length > 1)
        ls.push(
          ls[ls.length - 1]! +
            Math.hypot(
              px[px.length - 1]! - px[px.length - 2]!,
              y - py[py.length - 2]!,
            ),
        );
    }
    const L = ls[ls.length - 1]!;
    const kinds = [
      'tree',
      'chai',
      'sign',
      'pond',
      'lamp',
      'flowers',
      'rock',
      'wheel',
      'fence',
      'bench',
      'mailbox',
      'hydrant',
      'tree',
    ];
    const lm = [];
    let ki = 0;
    const nearest = (x: number, y: number) => {
      let b = 1e9;
      for (let i = 0; i < px.length; i += 2) {
        const d = Math.hypot(px[i]! - x, py[i]! - y);
        if (d < b) b = d;
      }
      return b;
    };
    // Landmarks stay inside the column and at least 40 px (plus their own half width) from the text-facing edge.
    const face = c.facing || -1,
      lx0 = face < 0 ? 96 : 56,
      lx1 = face > 0 ? w - 96 : w - 56;
    for (let y = y0 + 90; y < h - 50; y += 175) {
      const i = Math.min(px.length - 1, Math.max(0, Math.round((y - y0) / 6))),
        x0 = px[i]!;
      let best: { x: number; y: number } | null = null,
        bs = -1;
      for (const sd of [-1, 1]) {
        const x = clamp(x0 + sd * 110 * u, lx0, lx1);
        const sc2 = nearest(x, y);
        if (sc2 > bs) {
          bs = sc2;
          best = { x, y: y + 10 };
        }
      }
      lm.push({
        kind: kinds[ki++ % kinds.length],
        x: best!.x,
        y: best!.y,
        sz: (0.95 + rg() * 0.3) * u * 1.1,
      });
    }
    const dog = {
      s: 0,
      x: px[0]!,
      y: py[0]!,
      face: 1,
      mode: 'path',
      ph: 0,
      gait: 0,
      t: 0,
      head: 0,
      tail: 0.6,
      idle: 0,
      ball: false,
      pant: false,
    };
    const i0 = Math.max(
      0,
      Math.min(
        px.length - 1,
        Math.round((clamp(E.sy - c.t + E.H * 0.5, y0, h - 50) - y0) / 6),
      ),
    );
    dog.s = ls[i0]!;
    dog.x = px[i0]!;
    dog.y = py[i0]!;
    return {
      px,
      py,
      ls,
      L,
      lm,
      dog,
      prints: [],
      ball: null,
      u,
      pm: null,
      pstill: 0,
      near: 0,
      t: 0,
      pmv: 0,
      away: 0,
      y0,
      halfW,
      y1,
    };
  },
  tap(c: Col, s: State, x: number, y: number): void {
    const bx = clamp(x, BALL_R + 2, c.w - BALL_R - 2),
      by = clamp(y, s.y0, c.h - 14);
    s.ball = {
      x: bx,
      y: Math.max(24, by - 80),
      x1: bx,
      y1: by,
      t: 0,
      state: 'fall',
      vy: 0,
      rest: 0,
      carried: false,
    };
    s.dog.mode = 'fetch';
  },
  update(c: Col, s: State, dt: number): void {
    const d = s.dog,
      u = s.u;
    s.t += dt;
    d.t += dt;
    const t = s.t;
    // pointer
    const pv = c.mIn ? E.pspeed : 0;
    s.pmv = lerp(s.pmv, pv, 0.2);
    if (c.mIn) s.away = 0;
    else s.away += dt;
    const go = (tx: number, ty: number, sp: number, stopAt = 0) => {
      const dx = tx - d.x,
        dy = ty - d.y,
        L = Math.hypot(dx, dy);
      if (L <= stopAt + 0.5) {
        d.sp = 0;
        return 0;
      }
      const mv = Math.min(L - stopAt, sp * dt);
      d.x = clamp(d.x + (dx / L) * mv, s.halfW, c.w - s.halfW);
      d.y = clamp(d.y + (dy / L) * mv, s.y0, c.h - 8);
      d.sp = mv / dt;
      if (Math.abs(dx) > 3) d.face = dx > 0 ? 1 : -1;
      return L - mv;
    };
    d.sp = 0;
    // the ball
    const b = s.ball;
    if (b) {
      if (b.state === 'fall') {
        b.vy += 1500 * dt;
        b.y += b.vy * dt;
        if (b.y >= b.y1) {
          b.y = b.y1;
          b.vy = -b.vy * 0.45;
          b.bn = (b.bn || 0) + 1;
          if (b.bn > 2 || Math.abs(b.vy) < 90) {
            b.state = 'rest';
            b.vy = 0;
          }
        }
      } else if (b.state === 'carried') {
        b.x = d.x + d.face * 36 * u;
        b.y = d.y - 48 * u;
      } else if (b.state === 'dropped') {
        b.rest += dt;
        if (b.rest > 5) s.ball = null;
      }
    }
    // mode transitions
    const ytar = clamp(E.sy - c.t + E.H * 0.5, s.y0, c.h - 50);
    if (d.mode !== 'fetch' && d.mode !== 'bring') {
      if ((d.mode === 'chase' || d.mode === 'pet') && s.away > 1.6) {
        d.mode = 'return';
      }
    }
    // find the home point of the path: where the viewport is
    const sT = (() => {
      const i = Math.max(
        0,
        Math.min(s.px.length - 1, Math.round((ytar - s.y0) / 6)),
      );
      return s.ls[i];
    })();
    if (d.mode === 'path') {
      const diff = sT - d.s;
      if (Math.abs(diff) > 8) {
        const sp = Math.min(170, 30 + Math.abs(diff) * 1.1);
        const step = Math.sign(diff) * Math.min(Math.abs(diff), sp * dt);
        d.s += step;
        d.sp = Math.abs(step) / dt;
        d.idle = 0;
        const q = pathAt(s, d.s);
        if (Math.abs(q[0] - d.x) > 1) d.face = q[0] > d.x ? 1 : -1;
        d.x = q[0];
        d.y = q[1];
      } else {
        d.idle += dt;
        const q = pathAt(s, d.s);
        d.x = q[0];
        d.y = q[1];
      }
      d.pose = d.idle < 0.01 ? 'walk' : d.idle < 2.6 ? 'sniff' : 'sit';
    } else if (d.mode === 'chase') {
      const L = go(c.mx, c.my + 18, 330, 52);
      d.pose = 'walk';
      if (L < 3 && s.pmv < 120) {
        d.mode = 'pet';
      }
      if (!c.mIn && s.away > 1.6) d.mode = 'return';
    } else if (d.mode === 'pet') {
      d.pose = 'sit';
      d.petT = (d.petT || 0) + dt;
      if (c.mIn) {
        d.face = c.mx > d.x ? 1 : -1;
      }
      if (d.petT > 4) d.mode = 'return';
    } else if (d.mode === 'return') {
      // nearest path point
      let bi = 0,
        bd = 1e9;
      for (let i = 0; i < s.px.length; i += 2) {
        const dd = Math.hypot(s.px[i] - d.x, s.py[i] - d.y);
        if (dd < bd) {
          bd = dd;
          bi = i;
        }
      }
      const L = go(s.px[bi], s.py[bi], 140, 0);
      d.pose = 'walk';
      if (L < 4) {
        d.s = s.ls[bi];
        d.mode = 'path';
        d.idle = 0;
      }
    } else if (d.mode === 'fetch') {
      if (!b) {
        d.mode = 'path';
      } else if (b.state === 'fall') {
        d.pose = 'walk';
        d.sp = 0;
        if (Math.abs(b.x1 - d.x) > 3) d.face = b.x1 > d.x ? 1 : -1;
      } else if (b.state === 'rest') {
        const L = go(b.x - d.face * 0, b.y + 8, 190, 6);
        d.pose = 'walk';
        if (L < 3) {
          b.state = 'carried';
          b.carried = true;
          d.mode = 'bring';
          d.home = c.mIn ? [c.mx, c.my + 18] : pathAt(s, d.s);
        }
      }
    } else if (d.mode === 'bring') {
      const tgt = c.mIn ? [c.mx, c.my + 18] : d.home;
      const L = go(tgt[0], tgt[1], 170, 56);
      d.pose = 'walk';
      if (L < 4) {
        if (b) {
          b.state = 'dropped';
          b.rest = 0;
          b.carried = false;
          b.x = d.x + d.face * 40 * u;
          b.y = d.y;
        }
        d.mode = 'pet';
        d.petT = 0;
      }
    }
    // gait
    const moving = d.sp > 20;
    if (moving) d.ph += dt * (d.sp / 30 + 2);
    d.gait = lerp(
      d.gait,
      moving ? clamp(d.sp / 260, 0.45, 1) : 0,
      Math.min(1, dt * 10),
    );
    d.pant = d.sp > 200 || d.pose === 'sit';
    // paw prints
    if (moving) {
      s.lastPaw = s.lastPaw || { x: d.x, y: d.y };
      if (Math.hypot(d.x - s.lastPaw.x, d.y - s.lastPaw.y) > 26 * u) {
        s.prints.push({
          x: d.x,
          y: d.y + 1,
          a: Math.atan2(d.y - s.lastPaw.y, d.x - s.lastPaw.x),
          t: t,
          side: s.prints.length % 2 ? 1 : -1,
        });
        s.lastPaw = { x: d.x, y: d.y };
        if (s.prints.length > 26) s.prints.shift();
      }
    }
    const sniffAmt = d.pose === 'sniff' ? 1 : 0;
    d.head = lerp(
      d.head,
      sniffAmt * 0.85 +
        (moving ? 0.05 * Math.sin(d.ph * 2) : 0) -
        (d.pose === 'sit' ? 0.18 : 0),
      Math.min(1, dt * 6),
    );
    d.tail = lerp(
      d.tail,
      d.pose === 'sit' || d.mode === 'pet' ? 1 : moving ? 0.5 : 0.7,
      Math.min(1, dt * 4),
    );
  },
  draw(c: Col, s: State): void {
    const d = s.dog,
      u = s.u,
      t = s.t,
      D = E.day;
    // the trail: a dashed line, plus the walked part in solid
    const px = s.px,
      py = s.py;
    g.beginPath();
    g.setLineDash([9, 9]);
    g.moveTo(px[0], py[0]);
    for (let i = 1; i < px.length; i++) g.lineTo(px[i], py[i]);
    ink(0.6, 1.8);
    g.setLineDash([]);
    // landmarks
    const gl = sm(0.5, 0, D);
    for (const l of s.lm) {
      if (l.y < c.v0 - 90 || l.y > c.v1 + 40) continue;
      const k = l.kind;
      if (k === 'tree') DG.tree(l.x, l.y, l.sz, t);
      else if (k === 'sign')
        DG.sign(
          l.x,
          l.y,
          l.sz,
          l.y % 3 < 1 ? 'garden' : l.y % 3 < 2 ? 'park' : 'ktm',
        );
      else if (k === 'pond') DG.pond(l.x, l.y, l.sz, t);
      else if (k === 'lamp') DG.lamp(l.x, l.y, l.sz, gl);
      else if (k === 'rock') DG.rock(l.x, l.y, l.sz);
      else if (k === 'fence') DG.fence(l.x - 30 * l.sz, l.y, l.sz);
      else if (k === 'flowers') DG.flowers(l.x, l.y, l.sz, t);
      else if (k === 'chai') DG.chai(l.x, l.y, l.sz, t);
      else if (k === 'wheel') DG.wheel(l.x, l.y, l.sz);
      else if (k === 'bench') DG.bench(l.x, l.y, l.sz);
      else if (k === 'mailbox') DG.mailbox(l.x, l.y, l.sz);
      else DG.hydrant(l.x, l.y, l.sz);
      g.beginPath();
      g.moveTo(l.x - 30 * l.sz, l.y + 1);
      g.lineTo(l.x + 30 * l.sz, l.y + 1);
      ink(0.35, 1.2);
    }
    // paw prints
    for (const p of s.prints) {
      const age = t - p.t;
      if (age > 7) continue;
      DG.paw(
        p.x + Math.sin(p.a) * 5 * p.side * -1,
        p.y + Math.cos(p.a) * 5 * p.side * 0,
        p.a,
        0.6 * (1 - age / 7),
      );
    }
    // ball
    const b = s.ball;
    if (b && b.state !== 'carried') {
      const a = b.state === 'dropped' ? Math.min(1, (5 - b.rest) * 1.2) : 1;
      g.globalAlpha = a;
      DG.ball(b.x, b.y, 6 * u);
      if (b.state === 'fall') {
        g.beginPath();
        g.ellipse(b.x1, b.y1 + 7, 7, 2, 0, 0, TAU);
        ink(0.5, 1.2);
      }
      g.globalAlpha = 1;
    }
    // the dog
    if (d.y > c.v0 - 120 && d.y < c.v1 + 60) {
      const sc = u * 1.3;
      g.save();
      g.translate(d.x, d.y);
      g.scale(d.face * sc, sc);
      DG.dog(
        sc,
        d.ph,
        d.gait,
        clamp(d.head / 0.85, 0, 1),
        b && b.carried ? 1 : 0,
        d.tail,
        d.pose === 'sit' || (d.pant && d.gait > 0.5),
        t,
        !!(b && b.carried),
        d.pose === 'sit',
      );
      g.restore();
      g.beginPath();
      g.ellipse(d.x, d.y + 1, 30 * sc, 3.5, 0, 0, TAU);
      ink(0.25, 1.1);
    }
  },
};
