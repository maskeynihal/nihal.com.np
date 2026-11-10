/** Circuit board (section art). Traces, chips and LEDs with pulses that chain on tap. */
import {
  E,
  g,
  SA,
  PG,
  ink,
  fillS,
  fillP,
  circ,
  clamp,
  lerp,
  rnd,
  mulberry,
  TAU,
  PI,
} from './core';
import type { Col, Pt, Scene, State } from './core';

/** A part on the board: loose bag of fields (type, x, y, lit, nets, ...). */
interface Comp {
  type: string;
  x: number;
  y: number;
  lit: number;
  last: number;
  w: number;
  h: number;
  nets: Net[];
  id: number;
  ref: string;
  txt?: string;
  name?: string;
  pendingAt?: number | undefined;
  pendHop?: number;
  fromNet?: Net | null;
}
/** A trace: wobbled polyline with cumulative lengths, joining two parts. */
interface Route {
  pts: Pt[];
  cum: number[];
  len: number;
}
interface Net extends Route {
  a: Comp;
  b: Comp;
}
interface Pulse {
  net: Net;
  d: number;
  dir: number;
  sp: number;
  hop: number;
}

const CB = {
  route(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    ym: number,
    seed: number,
  ): Route {
    const ch = Math.min(
      11,
      Math.abs(x2 - x1) / 2,
      Math.abs(ym - y1) - 1,
      Math.abs(y2 - ym) - 1,
    );
    let pts: Pt[];
    if (Math.abs(x2 - x1) < 2)
      pts = [
        [x1, y1],
        [x2, y2],
      ];
    else {
      const d = x2 > x1 ? 1 : -1;
      pts = [
        [x1, y1],
        [x1, ym - ch],
        [x1 + d * ch, ym],
        [x2 - d * ch, ym],
        [x2, ym + ch],
        [x2, y2],
      ];
    }
    // subdivide with a hand-drawn wobble
    const o: Pt[] = [];
    let k = 0;
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i]!,
        b = pts[i + 1]!,
        L = Math.hypot(b[0] - a[0], b[1] - a[1]),
        n = Math.max(1, Math.round(L / 12)),
        nx = -(b[1] - a[1]) / L,
        ny = (b[0] - a[0]) / L;
      for (let j = 0; j < n; j++) {
        const t = j / n,
          r = (rnd(seed + k++ * 2.3) - 0.5) * 1.2;
        o.push([
          a[0] + (b[0] - a[0]) * t + nx * r,
          a[1] + (b[1] - a[1]) * t + ny * r,
        ]);
      }
    }
    o.push(pts[pts.length - 1]!);
    const cum = [0];
    for (let i = 1; i < o.length; i++)
      cum.push(
        cum[i - 1]! +
          Math.hypot(o[i]![0] - o[i - 1]![0], o[i]![1] - o[i - 1]![1]),
      );
    return { pts: o, cum, len: cum[cum.length - 1]! };
  },
  at(net: Route, d: number): Pt {
    // point at distance d
    const c = net.cum;
    d = clamp(d, 0, net.len);
    let lo = 0,
      hi = c.length - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (c[m]! < d) lo = m;
      else hi = m;
    }
    const t = (d - c[lo]!) / (c[hi]! - c[lo]! || 1);
    return [
      lerp(net.pts[lo]![0], net.pts[hi]![0], t),
      lerp(net.pts[lo]![1], net.pts[hi]![1], t),
    ];
  },
  glow(x: number, y: number, r: number, a: number): void {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, SA(a));
    gr.addColorStop(1, SA(0));
    g.fillStyle = gr;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  },
  draw: {
    chip(c: Comp): void {
      const w = c.w,
        h = c.h,
        x = c.x - w / 2,
        y = c.y - h / 2,
        l = c.lit;
      g.beginPath();
      g.rect(x, y, w, h);
      fillP();
      if (l > 0.02) fillS(0.16 * l);
      ink(0.95, 2);
      g.beginPath();
      g.rect(x + 4, y + 4, w - 8, h - 8);
      ink(0.35, 1);
      g.beginPath();
      g.arc(x + w * 0.5, y, 6, 0, PI);
      ink(0.9, 1.4);
      g.beginPath();
      const np = Math.max(3, Math.floor(w / 22));
      for (let i = 0; i < np; i++) {
        const px = x + ((i + 0.5) * w) / np;
        g.moveTo(px, y);
        g.lineTo(px, y - 7);
        g.moveTo(px, y + h);
        g.lineTo(px, y + h + 7);
      }
      for (let i = 0; i < 3; i++) {
        const py = y + ((i + 0.5) * h) / 3;
        g.moveTo(x, py);
        g.lineTo(x - 7, py);
        g.moveTo(x + w, py);
        g.lineTo(x + w + 7, py);
      }
      ink(0.9, 1.6);
      g.font = '10px ui-monospace,Menlo,monospace';
      g.textAlign = 'center';
      g.fillStyle = SA(0.95);
      g.fillText(c.name!, c.x, c.y + 4);
      g.font = '8px ui-monospace,Menlo,monospace';
      g.fillStyle = SA(0.6);
      g.textAlign = 'left';
      g.fillText(c.ref, x + 8, y + h - 8);
      circ(x + w - 10, y + 10, 2.4);
      if (l > 0.3) fillS(1);
      else ink(0.8, 1.1);
    },
    led(c: Comp): void {
      const x = c.x,
        y = c.y,
        l = c.lit;
      if (l > 0.02) {
        CB.glow(x, y, 34 + l * 20, 0.35 * l);
      }
      g.beginPath();
      g.moveTo(x - 13, y - 12);
      g.lineTo(x + 13, y - 12);
      g.lineTo(x, y + 10);
      g.closePath();
      fillP();
      if (l > 0.02) fillS(0.9 * l);
      ink(0.95, 2);
      g.beginPath();
      g.moveTo(x - 14, y + 11);
      g.lineTo(x + 14, y + 11);
      g.moveTo(x, y - 22);
      g.lineTo(x, y - 12);
      g.moveTo(x, y + 11);
      g.lineTo(x, y + 22);
      ink(0.95, 2);
      for (const sd of [0, 1]) {
        const ox = x + 16 + sd * 7,
          oy = y - 8 + sd * 6;
        g.beginPath();
        g.moveTo(ox - 9, oy + 9);
        g.lineTo(ox, oy);
        g.moveTo(ox - 3, oy);
        g.lineTo(ox, oy);
        g.lineTo(ox, oy + 3);
        ink(0.7 + 0.3 * l, 1.4);
      }
      if (l > 0.1) {
        g.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i * TAU) / 8 + 0.4;
          g.moveTo(x + Math.cos(a) * 30, y + Math.sin(a) * 30);
          g.lineTo(
            x + Math.cos(a) * (34 + l * 12),
            y + Math.sin(a) * (34 + l * 12),
          );
        }
        ink(l, 1.6);
      }
    },
    res(c: Comp): void {
      const x = c.x,
        y = c.y,
        l = c.lit;
      g.beginPath();
      g.moveTo(x, y - 26);
      g.lineTo(x, y - 18);
      g.lineTo(x - 9, y - 13);
      g.lineTo(x + 9, y - 5);
      g.lineTo(x - 9, y + 3);
      g.lineTo(x + 9, y + 11);
      g.lineTo(x, y + 16);
      g.lineTo(x, y + 26);
      ink(0.9 + 0.1 * l, 2);
      if (l > 0.05) {
        CB.glow(x, y, 26, 0.3 * l);
      }
      g.font = '9px ui-monospace,Menlo,monospace';
      g.textAlign = 'left';
      g.fillStyle = SA(0.7);
      g.fillText(c.ref, x + 14, y + 3);
    },
    buzzer(c: Comp, t: number): void {
      const x = c.x + (c.lit > 0.1 ? 0 : 0),
        y = c.y,
        l = c.lit;
      g.beginPath();
      g.arc(x, y, 21, 0, TAU);
      fillP();
      if (l > 0.02) fillS(0.15 * l);
      ink(0.95, 2);
      g.beginPath();
      g.arc(x, y, 12, 0, TAU);
      ink(0.5, 1.2);
      circ(x, y, 3);
      fillS(0.8);
      g.beginPath();
      g.moveTo(x - 16, y - 14);
      g.lineTo(x - 16, y - 8);
      g.moveTo(x - 19, y - 11);
      g.lineTo(x - 13, y - 11);
      ink(0.9, 1.5);
      g.beginPath();
      g.moveTo(x, y - 21);
      g.lineTo(x, y - 28);
      g.moveTo(x, y + 21);
      g.lineTo(x, y + 28);
      ink(0.95, 2);
      const n = l > 0.05 ? 3 : 0;
      for (let i = 0; i < n; i++) {
        const r = 26 + ((t * 10 + i * 12) % 36);
        const a = Math.max(0, 1 - (r - 26) / 36) * l;
        g.beginPath();
        g.arc(x, y, r, -PI * 0.3, PI * 0.3);
        g.arc(x, y, r, PI * 0.7, PI * 1.3);
        ink(a * 0.9, 1.6);
      }
    },
    sensor(c: Comp): void {
      // TO-92 can, like the DS18B20
      const x = c.x,
        y = c.y,
        l = c.lit;
      g.beginPath();
      g.moveTo(x - 17, y + 8);
      g.arc(x, y + 8, 17, PI, TAU);
      g.closePath();
      fillP();
      if (l > 0.02) fillS(0.14 * l);
      ink(0.95, 2);
      g.beginPath();
      g.moveTo(x - 8, y + 8);
      g.lineTo(x - 8, y + 18);
      g.moveTo(x, y + 8);
      g.lineTo(x, y + 24);
      g.moveTo(x + 8, y + 8);
      g.lineTo(x + 8, y + 18);
      ink(0.9, 1.8);
      g.beginPath();
      g.moveTo(x - 8, y - 6);
      g.lineTo(x - 8, y - 12);
      g.moveTo(x, y - 9);
      g.lineTo(x, y - 24);
      g.moveTo(x + 8, y - 6);
      g.lineTo(x + 8, y - 12);
      ink(0.0, 1);
      g.font = '9px ui-monospace,Menlo,monospace';
      g.textAlign = 'center';
      g.fillStyle = SA(0.9);
      g.fillText('T', x, y + 4);
      g.beginPath();
      g.moveTo(x, y - 9);
      g.lineTo(x, y - 24);
      ink(0.95, 2);
      if (l > 0.05) {
        g.beginPath();
        g.arc(x, y, 24 + (1 - l) * 14, PI * 1.1, PI * 1.9);
        ink(l * 0.8, 1.5);
      }
    },
    oled(c: Comp): void {
      const x = c.x - 30,
        y = c.y - 19,
        l = c.lit;
      g.beginPath();
      g.rect(x, y, 60, 38);
      fillP();
      ink(0.95, 2);
      g.beginPath();
      g.rect(x + 4, y + 4, 52, 30);
      fillS(0.12 + 0.5 * l);
      ink(0.7, 1.2);
      g.font = '11px ui-monospace,Menlo,monospace';
      g.textAlign = 'center';
      g.fillStyle = l > 0.5 ? PG(1) : SA(0.95);
      g.fillText(c.txt!, c.x, y + 24);
      g.beginPath();
      g.moveTo(c.x, y - 8);
      g.lineTo(c.x, y);
      g.moveTo(c.x, y + 38);
      g.lineTo(c.x, y + 46);
      ink(0.95, 2);
    },
    button(c: Comp): void {
      const x = c.x,
        y = c.y,
        l = c.lit;
      g.beginPath();
      g.rect(x - 18, y - 18, 36, 36);
      fillP();
      ink(0.95, 2);
      g.beginPath();
      g.arc(x, y, 10 - l * 2, 0, TAU);
      if (l > 0.1) fillS(0.8 * l);
      ink(0.9, 1.8);
      for (const [dx, dy] of [
        [-12, -12],
        [12, -12],
        [-12, 12],
        [12, 12],
      ] as Pt[]) {
        circ(x + dx, y + dy, 1.6);
        ink(0.7, 1);
      }
      g.beginPath();
      g.moveTo(x, y - 18);
      g.lineTo(x, y - 28);
      g.moveTo(x, y + 18);
      g.lineTo(x, y + 28);
      ink(0.95, 2);
      g.font = '9px ui-monospace,Menlo,monospace';
      g.textAlign = 'left';
      g.fillStyle = SA(0.7);
      g.fillText('SW', x + 22, y - 12);
    },
    usb(c: Comp): void {
      const x = c.x,
        y = c.y,
        l = c.lit;
      g.beginPath();
      g.rect(x - 26, y - 18, 52, 32);
      fillP();
      if (l > 0.02) fillS(0.15 * l);
      ink(0.95, 2);
      g.beginPath();
      g.rect(x - 17, y - 11, 34, 12);
      ink(0.7, 1.4);
      g.beginPath();
      g.moveTo(x - 12, y - 5);
      g.lineTo(x + 12, y - 5);
      ink(0.5, 1);
      g.beginPath();
      g.moveTo(x, y + 14);
      g.lineTo(x, y + 28);
      ink(0.95, 2);
      g.font = '9px ui-monospace,Menlo,monospace';
      g.textAlign = 'left';
      g.fillStyle = SA(0.9);
      g.fillText('5V', x + 31, y - 4);
    },
    gnd(c: Comp): void {
      const x = c.x,
        y = c.y;
      g.beginPath();
      g.moveTo(x, y - 12);
      g.lineTo(x, y);
      g.moveTo(x - 18, y);
      g.lineTo(x + 18, y);
      g.moveTo(x - 12, y + 6);
      g.lineTo(x + 12, y + 6);
      g.moveTo(x - 6, y + 12);
      g.lineTo(x + 6, y + 12);
      ink(0.95, 2);
      g.font = '9px ui-monospace,Menlo,monospace';
      g.textAlign = 'left';
      g.fillStyle = SA(0.7);
      g.fillText('GND', x + 24, y + 8);
    },
  },
  fire(s: State, o: Comp, hop: number): void {
    o.lit = 1;
    o.last = s.t;
    s.fires++;
    CB.emit(s, o, hop, null);
  },
  emit(s: State, o: Comp, hop: number, from?: Net | null): void {
    // One signal walks the board: it leaves a part along a single trace, never several at once.
    if (hop > 6) return;
    const c2 = o.nets.filter((n: Net) => n !== from);
    if (!c2.length) return;
    const n = c2[Math.floor(rnd(s.t, hop + o.id) * c2.length)]!,
      dir = n.a === o ? 1 : -1;
    s.pulses.push({ net: n, d: 0, dir, sp: 60 + rnd(s.t) * 15, hop });
  },
  arrive(s: State, o: Comp, p: Pulse): void {
    if (s.t - o.last < 1.0) {
      o.lit = Math.max(o.lit, 0.5);
      return;
    }
    o.lit = 1;
    o.last = s.t;
    if (o.type === 'oled') {
      o.txt = (15 + Math.random() * 20).toFixed(1) + 'C';
    }
    o.pendingAt = s.t + 0.1;
    o.pendHop = p.hop + 1;
    o.fromNet = p.net;
  },
};
export const circuit: Scene = {
  init(c: Col): State {
    const w = c.w,
      h = c.h,
      rg = mulberry(c.seed * 19 + 3);
    const comps: Comp[] = [],
      nets: Net[] = [];
    const cw = clamp(w * 0.34, 110, 190),
      ch = 64;
    const nL = Math.max(1, Math.round((h - 250) / 230));
    const top = c.phone ? 90 : 120,
      bot = h - 70;
    const ls = (bot - top) / (nL + 0.35);
    const xa = w * (c.phone ? 0.2 : 0.2),
      xb = w * (c.phone ? 0.8 : 0.8),
      cx = w / 2;
    const kinds: string[] = [
      'led',
      'res',
      'buzzer',
      'sensor',
      'oled',
      'button',
    ];
    for (let i = kinds.length - 1; i > 0; i--) {
      const j = Math.floor(rg() * (i + 1));
      [kinds[i], kinds[j]] = [kinds[j]!, kinds[i]!];
    }
    const mk = (
      type: string,
      x: number,
      y: number,
      extra?: Partial<Comp>,
    ): Comp => {
      const o: Comp = Object.assign(
        {
          type,
          x,
          y,
          lit: 0,
          last: -9,
          w: 0,
          h: 0,
          nets: [],
          id: comps.length,
          ref: '',
        },
        extra || {},
      );
      comps.push(o);
      return o;
    };
    const usb = mk('usb', cx, 42, { h: 46 });
    let ki = 0,
      rc = 1;
    const names = ['UNO R4', 'ESP32', 'ATtiny', 'STM32', 'CH340', '74HC595'];
    const net = (a: Comp, pa: Pt, b: Comp, pb: Pt, ym: number): Net => {
      const n: Net = Object.assign(
        CB.route(pa[0], pa[1], pb[0], pb[1], ym, nets.length * 7.7 + c.seed),
        { a, b },
      );
      nets.push(n);
      a.nets.push(n);
      b.nets.push(n);
      return n;
    };
    let prevOuts: Comp[] = [usb];
    const chips: Comp[] = [];
    for (let L = 0; L < nL; L++) {
      const cy = top + L * ls * 1,
        y2 = cy + ls * 0.62;
      const chip = mk('chip', cx, cy, {
        w: cw,
        h: ch,
        name: names[L % names.length]!,
        ref: 'U' + (L + 1),
      });
      chips.push(chip);
      // incoming
      if (L === 0) {
        net(
          usb,
          [cx, usb.y + 28],
          chip,
          [cx - cw / 4, cy - ch / 2 - 7],
          (usb.y + 28 + cy - ch / 2 - 7) / 2,
        );
      } else {
        for (const [i, o] of prevOuts.entries()) {
          net(
            o,
            [o.x, o.y + hsC(o)],
            chip,
            [cx + (i ? 1 : -1) * cw * 0.3, cy - ch / 2 - 7],
            cy - ch / 2 - 30 - i * 8,
          );
        }
      }
      const ka = kinds[ki++ % kinds.length]!,
        kb = kinds[ki++ % kinds.length]!;
      const A = mk(ka, xa, y2, {
          h: hsC2(ka) * 2,
          ref: ka === 'res' ? 'R' + rc++ : '',
        }),
        B = mk(kb, xb, y2, {
          h: hsC2(kb) * 2,
          ref: kb === 'res' ? 'R' + rc++ : '',
        });
      if (ka === 'oled') A.txt = '23.4C';
      if (kb === 'oled') B.txt = '64%';
      net(
        chip,
        [cx - cw * 0.3, cy + ch / 2 + 7],
        A,
        [xa, y2 - hsC(A)],
        cy + ch / 2 + 20,
      );
      net(
        chip,
        [cx + cw * 0.3, cy + ch / 2 + 7],
        B,
        [xb, y2 - hsC(B)],
        cy + ch / 2 + 28,
      );
      prevOuts = [A, B];
    }
    const last = prevOuts;
    const gy = bot - 6;
    const gnd = mk('gnd', cx, gy, {});
    for (const [i, o] of last.entries()) {
      net(
        o,
        [o.x, o.y + hsC(o)],
        gnd,
        [cx + (i ? 1 : -1) * 0, gy - 12],
        gy - 34 - i * 10,
      );
    }
    function hsC(o: Comp): number {
      return hsC2(o.type);
    }
    function hsC2(t: string): number {
      return (
        (
          {
            led: 22,
            res: 26,
            buzzer: 28,
            sensor: 24,
            oled: 46,
            button: 28,
            usb: 28,
            chip: ch / 2 + 7,
          } as Record<string, number>
        )[t] || 26
      );
    }
    // fix port y for comps whose bottom port is below centre
    return {
      comps,
      nets,
      pulses: [],
      t: 0,
      next: 1.2,
      chips,
      hover: null,
      fires: 0,
    };
  },
  tap(_c: Col, s: State, x: number, y: number): void {
    let best: Comp | null = null,
      bd = 1e9;
    for (const o of s.comps as Comp[]) {
      if (o.type === 'gnd') continue;
      const d = Math.hypot(o.x - x, o.y - y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    if (best && bd < 170) {
      s.pulses.length = 0;
      for (const o of s.comps as Comp[]) o.pendingAt = undefined;
      CB.fire(s, best, 0);
    }
  },
  update(c: Col, s: State, dt: number): void {
    s.t += dt;
    s.next -= dt * (1 + Math.abs(E.sv) / 2500);
    if (s.next <= 0) {
      s.next = 11 + rnd(s.t) * 9;
      if (
        !s.pulses.length &&
        !(s.comps as Comp[]).some((o) => o.pendingAt !== undefined)
      ) {
        const vis = (s.chips as Comp[]).filter((o) => o.y > c.v0 && o.y < c.v1);
        const pool = vis.length ? vis : s.chips;
        CB.fire(s, pool[Math.floor(rnd(s.t, 4) * pool.length)]!, 0);
      }
    }
    for (const o of s.comps as Comp[]) {
      o.lit *= Math.exp(-dt * 0.8);
      if (o.pendingAt !== undefined && s.t >= o.pendingAt) {
        o.pendingAt = undefined;
        CB.emit(s, o, o.pendHop!, o.fromNet);
      }
    }
    for (const p of s.pulses as Pulse[]) {
      p.d += p.sp * dt;
    }
    for (let i = s.pulses.length - 1; i >= 0; i--) {
      const p = (s.pulses as Pulse[])[i]!;
      if (p.d >= p.net.len) {
        const dst = p.dir > 0 ? p.net.b : p.net.a;
        s.pulses.splice(i, 1);
        CB.arrive(s, dst, p);
      }
    }
    // hover
    s.hover = null;
    if (c.mIn) {
      let bd = 60;
      for (const o of s.comps as Comp[]) {
        if (o.type === 'gnd') continue;
        const d = Math.hypot(o.x - c.mx, o.y - c.my);
        if (d < bd) {
          bd = d;
          s.hover = o;
        }
      }
    }
  },
  draw(c: Col, s: State): void {
    const t = s.t;
    // corner mounting holes
    for (const [x, y] of [
      [16, 16],
      [c.w - 16, 16],
      [16, c.h - 16],
      [c.w - 16, c.h - 16],
    ] as Pt[]) {
      g.beginPath();
      g.arc(x, y, 6, 0, TAU);
      ink(0.6, 1.4);
      g.beginPath();
      g.moveTo(x - 9, y);
      g.lineTo(x + 9, y);
      g.moveTo(x, y - 9);
      g.lineTo(x, y + 9);
      ink(0.35, 1);
    }
    // traces
    for (const n of s.nets as Net[]) {
      const p = n.pts;
      if (n.b.y < c.v0 - 60 || n.a.y > c.v1 + 60) continue;
      g.beginPath();
      g.moveTo(p[0]![0], p[0]![1]);
      for (let i = 1; i < p.length; i++) g.lineTo(p[i]![0], p[i]![1]);
      ink(0.7, 1.7);
      for (const q of [p[0]!, p[p.length - 1]!]) {
        circ(q[0], q[1], 3.4);
        fillP();
        ink(0.9, 1.5);
      }
    }
    // components
    for (const o of s.comps as Comp[]) {
      if (o.y < c.v0 - 90 || o.y > c.v1 + 90) continue;
      (CB.draw as Record<string, (c: Comp, t: number) => void>)[o.type]!(o, t);
    }
    // pulses
    for (const pl of s.pulses as Pulse[]) {
      const n = pl.net,
        tail = 22,
        pos = pl.dir > 0 ? pl.d : n.len - pl.d;
      const trace = () => {
        g.beginPath();
        for (let k = 0; k <= 8; k++) {
          const q = CB.at(n, pos - (pl.dir * tail * k) / 8);
          if (k) g.lineTo(q[0], q[1]);
          else g.moveTo(q[0], q[1]);
        }
      };
      trace();
      ink(0.2, 5);
      trace();
      ink(0.8, 2);
      const hq = CB.at(n, pos);
      circ(hq[0], hq[1], 3);
      fillS(0.8);
    }
    if (s.hover) {
      const o = s.hover as Comp,
        pu = 0;
      g.beginPath();
      if (o.type === 'chip')
        g.rect(
          o.x - o.w / 2 - 12 - pu,
          o.y - o.h / 2 - 14 - pu,
          o.w + 24 + pu * 2,
          o.h + 28 + pu * 2,
        );
      else g.arc(o.x, o.y, 40 + pu, 0, TAU);
      ink(0.6, 1.3);
    }
  },
};
