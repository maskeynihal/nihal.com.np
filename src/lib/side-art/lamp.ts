/** Lamp-world (section art). The sky follows the real lamp: day birds and sun, dusk windows, night stars and fireflies. */
import {
  E,
  g,
  SA,
  ink,
  fillS,
  fillP,
  circ,
  glow,
  clamp,
  lerp,
  sm,
  rnd,
  mulberry,
  TAU,
  PI,
} from './core';
import type { Col, State, Pt, Scene } from './core';

/**
 * Largest extents (px) of what moves or has a body: a bird's wings (15 x size up to 1.3), a bat's (16 x size
 * up to 1.8), the sun with its rays and dusk arcs, the moon with its halo, a cloud, a firefly with its glow.
 * Birds, bats, clouds and fireflies fade out before their body reaches the safe edge; the sun and moon are
 * kept wholly inside it.
 */
export const BIRD_REACH = 24;
export const BAT_REACH = 32;
export const SUN_REACH = 112;
export const MOON_REACH = 52;
export const CLOUD_REACH = 96;
export const FLY_REACH = 14;
/** 0 at the edge, 1 once a body of this reach is wholly inside; the fade is over 2 x reach + 20. */
const edgeFade = (x: number, w: number, r: number): number =>
  Math.min(sm(0, 2 * r + 20, x), sm(0, 2 * r + 20, w - x));

const LW = {
  bird(x: number, y: number, flap: number, sz: number, bat: boolean): void {
    const f = Math.sin(flap) * 0.9;
    g.save();
    g.translate(x, y);
    g.scale(sz, sz);
    g.beginPath();
    if (bat) {
      g.moveTo(0, 0);
      g.quadraticCurveTo(-8, -8 - f * 8, -16, -2 - f * 6);
      g.quadraticCurveTo(-13, 0, -10, 2);
      g.quadraticCurveTo(-7, 0, -5, 3);
      g.quadraticCurveTo(-2, 1, 0, 4);
      g.quadraticCurveTo(2, 1, 5, 3);
      g.quadraticCurveTo(7, 0, 10, 2);
      g.quadraticCurveTo(13, 0, 16, -2 - f * 6);
      g.quadraticCurveTo(8, -8 - f * 8, 0, 0);
      fillS(0.85);
    } else {
      g.moveTo(-15, -4 * f - 1);
      g.quadraticCurveTo(-8, -9 * f - 5, 0, 0);
      g.quadraticCurveTo(8, -9 * f - 5, 15, -4 * f - 1);
      ink(0.95, 2);
    }
    g.restore();
  },
  cloud(x: number, y: number, sz: number): void {
    g.beginPath();
    g.moveTo(x - 46 * sz, y);
    g.bezierCurveTo(
      x - 58 * sz,
      y,
      x - 58 * sz,
      y - 20 * sz,
      x - 38 * sz,
      y - 20 * sz,
    );
    g.bezierCurveTo(
      x - 36 * sz,
      y - 38 * sz,
      x - 8 * sz,
      y - 40 * sz,
      x - 2 * sz,
      y - 24 * sz,
    );
    g.bezierCurveTo(
      x + 10 * sz,
      y - 38 * sz,
      x + 36 * sz,
      y - 30 * sz,
      x + 32 * sz,
      y - 14 * sz,
    );
    g.bezierCurveTo(x + 52 * sz, y - 16 * sz, x + 56 * sz, y, x + 40 * sz, y);
    g.closePath();
    fillP();
    ink(0.85, 1.7);
    g.beginPath();
    g.moveTo(x - 30 * sz, y - 6 * sz);
    g.lineTo(x + 26 * sz, y - 6 * sz);
    g.moveTo(x - 22 * sz, y - 11 * sz);
    g.lineTo(x + 10 * sz, y - 11 * sz);
    ink(0.4, 1.1);
  },
  star(x: number, y: number, r: number, tw: number, big: boolean): void {
    g.beginPath();
    if (big) {
      g.moveTo(x - r * 2.2, y);
      g.lineTo(x + r * 2.2, y);
      g.moveTo(x, y - r * 2.2);
      g.lineTo(x, y + r * 2.2);
      g.moveTo(x - r * 1.1, y - r * 1.1);
      g.lineTo(x + r * 1.1, y + r * 1.1);
      g.moveTo(x + r * 1.1, y - r * 1.1);
      g.lineTo(x - r * 1.1, y + r * 1.1);
      ink(tw, 1.3);
    } else {
      g.arc(x, y, r, 0, TAU);
      fillS(tw);
    }
  },
};
export const lamp: Scene & { name: string; short: string } = {
  name: 'lamp world',
  short: 'lamp',
  init(c: Col): State {
    const w = c.w,
      h = c.h,
      rg = mulberry(c.seed * 23 + 9),
      u = clamp(w / 520, 0.72, 1.1);
    const gh = (c.phone ? 150 : 170) * u;
    // skyline buildings
    const houses: State[] = [];
    let x = 8;
    while (x < w - 8) {
      const wd = (26 + rg() * 30) * u,
        ht = (28 + rg() * 60) * u;
      const wins = [];
      for (let r = 0; r < Math.floor(ht / (18 * u)); r++)
        for (let k = 0; k < Math.max(1, Math.floor(wd / (16 * u))); k++)
          wins.push({
            x:
              x +
              (6 + (k * (wd - 12)) / Math.max(1, Math.floor(wd / (16 * u)))) *
                1,
            y: -ht + (8 + r * 18) * u,
            thr: rg(),
            ph: rg() * 9,
          });
      if (x + wd > w - 8) break;
      houses.push({ x, wd, ht, wins, kind: rg() });
      x += wd + rg() * 5 * u;
    }
    const stars = Array.from(
      { length: Math.round(clamp((w * h) / 8500, 26, 120)) },
      () => ({
        x: rg() * w,
        y: rg() * (h - gh - 30),
        r: 0.8 + rg() * 1.3,
        ph: rg() * 9,
        big: rg() < 0.2,
      }),
    );
    const clouds = Array.from({ length: Math.round(h / 250) + 2 }, () => ({
      x: rg() * w,
      y: 70 + rg() * (h - gh - 170),
      sz: (0.8 + rg() * 0.7) * u,
      v: 3 + rg() * 4,
    }));
    const birds = Array.from({ length: Math.round(h / 420) + 1 }, () => ({
      x: rg() * w,
      y: 60 + rg() * (h - gh - 200),
      vx: (rg() < 0.5 ? -1 : 1) * (14 + rg() * 12),
      vy: 0,
      fl: rg() * 9,
      sz: (0.7 + rg() * 0.5) * u,
    }));
    const bats = Array.from({ length: Math.round(h / 600) + 1 }, () => ({
      x: rg() * w,
      y: 90 + rg() * (h - gh - 240),
      vx: 30,
      vy: 10,
      fl: rg() * 9,
      sz: (1.1 + rg() * 0.5) * u,
      ph: rg() * 9,
    }));
    const flies = Array.from({ length: Math.round(h / 300) + 3 }, () => ({
      x: rg() * w,
      y: rg() * (h - gh - 40) + 40,
      vx: 0,
      vy: 0,
      ph: rg() * 9,
      hx: rg() * w,
      hy: h - gh - 20 - rg() * Math.min(h * 0.6, 520),
      life: 1,
    }));
    return {
      w,
      h,
      u,
      gh,
      houses,
      stars,
      clouds,
      birds,
      bats,
      flies,
      lanterns: [],
      meteors: [],
      mt: 3,
      clk: 0,
      scatter: 0,
      flags: rg() * 9,
      sun: { x: w * 0.7, y: 200 },
      moon: { x: w * 0.3, y: 300 },
      ridge: Array.from(
        { length: Math.ceil(w / 14) + 2 },
        (_, i) =>
          -(
            Math.abs(Math.sin(i * 0.19 + c.seed)) * 52 +
            Math.abs(Math.sin(i * 0.07 + 2 + c.seed)) * 60
          ) *
            u +
          rg() * 3,
      ),
    };
  },
  tap(c: Col, s: State, x: number, y: number): void {
    const D = E.day;
    if (D > 0.55) {
      for (const b of s.birds) {
        const dx = b.x - x,
          dy = b.y - y,
          d = Math.hypot(dx, dy);
        if (d < 260) {
          const f = 1 - d / 260;
          b.vx = (dx / (d || 1)) * (60 + f * 120);
          b.vy = (dy / (d || 1)) * (60 + f * 120) - 60;
        }
      }
      for (let i = 0; i < 5; i++)
        s.birds.push({
          x: x,
          y: y,
          vx: (Math.random() - 0.5) * 120,
          vy: -50 - Math.random() * 60,
          fl: 0,
          sz: 0.8 * s.u,
          temp: 3.5 + Math.random() * 2,
        });
    }
    if (D < 0.7)
      s.lanterns.push({
        x,
        y,
        ph: Math.random() * 9,
        t: 0,
        sz: (0.9 + Math.random() * 0.3) * s.u,
      });
    if (D < 0.45) {
      for (let i = 0; i < 3; i++)
        s.flies.push({
          x: x,
          y: y,
          vx: (Math.random() - 0.5) * 60,
          vy: (Math.random() - 0.5) * 60,
          ph: Math.random() * 9,
          hx: x,
          hy: y,
          life: 7,
          temp: 1,
        });
    }
    if (D < 0.25)
      s.meteors.push({
        x: x < c.w * 0.5 ? c.w * 0.9 : c.w * 0.1,
        y: Math.max(30, y - 160),
        vx: x < c.w * 0.5 ? -200 : 200,
        vy: 110,
        t: 0,
      });
  },
  update(c: Col, s: State, dt: number): void {
    const D = E.day,
      w = c.w,
      hz = c.h - s.gh;
    s.clk += dt;
    const t = s.clk;
    const pm = c.mIn;
    for (const cl of s.clouds) {
      cl.x += cl.v * dt * (1 + Math.abs(E.sv) / 400);
      if (cl.x > w + 70) cl.x = -70;
    }
    for (let i = s.birds.length - 1; i >= 0; i--) {
      const b = s.birds[i];
      b.vx +=
        ((b.vx < 0 ? -1 : 1) * (20 + Math.abs(E.sv) * 0.02) - b.vx) * dt * 0.6;
      b.vy *= Math.exp(-dt * 1.3);
      b.vy += Math.sin(t * 1.7 + i) * 10 * dt;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.fl += dt * (4.5 + Math.abs(b.vy) * 0.02 + (b.temp ? 3 : 0));
      if (b.temp) {
        b.temp -= dt;
        if (b.temp <= 0 && (b.x < -30 || b.x > w + 30 || b.y < -40)) {
          s.birds.splice(i, 1);
          continue;
        }
        if (b.temp < -6) {
          s.birds.splice(i, 1);
          continue;
        }
      }
      if (b.x < -30) b.x = w + 30;
      if (b.x > w + 30) b.x = -30;
      b.y = clamp(b.y, 20, hz - 90);
    }
    for (const b of s.bats) {
      b.vx += (Math.sin(t * 2.3 + b.ph) * 28 - b.vx * 0.4) * dt * 2;
      b.vy += (Math.cos(t * 3.1 + b.ph * 2) * 34 - b.vy * 0.5) * dt * 2;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.fl += dt * 8;
      if (b.x < 10 || b.x > w - 10) b.vx *= -1;
      b.x = clamp(b.x, 6, w - 6);
      b.y = clamp(b.y, 40, hz - 60);
    }
    for (let i = s.flies.length - 1; i >= 0; i--) {
      const f = s.flies[i];
      let tx = f.hx + Math.sin(t * 0.7 + f.ph) * 60,
        ty = f.hy + Math.cos(t * 0.9 + f.ph * 1.3) * 50;
      if (pm && D < 0.5) {
        const a = t * 0.7 + f.ph * 3,
          r = 26 + (f.ph % 1) * 50;
        tx = c.mx + Math.cos(a) * r;
        ty = c.my + Math.sin(a * 1.2) * r * 0.8;
      }
      f.vx +=
        ((tx - f.x) * 0.7 - f.vx * 1.4) * dt +
        (rnd(t * 3, f.ph) - 0.5) * 50 * dt;
      f.vy +=
        ((ty - f.y) * 0.7 - f.vy * 1.4) * dt +
        (rnd(t * 3, f.ph + 1) - 0.5) * 50 * dt;
      f.x += f.vx * dt;
      f.y += f.vy * dt;
      if (f.temp) {
        f.life -= dt;
        if (f.life <= 0) s.flies.splice(i, 1);
      }
    }
    for (let i = s.lanterns.length - 1; i >= 0; i--) {
      const l = s.lanterns[i];
      l.t += dt;
      l.y -= (9 + l.t * 0.8) * dt;
      l.x = clamp(l.x + Math.sin(l.t * 0.8 + l.ph) * 14 * dt, 34, w - 34);
      if (l.y < c.v0 - 140 || l.t > 60) s.lanterns.splice(i, 1);
    }
    s.mt -= dt; // meteor spawning is switched off
    for (let i = s.meteors.length - 1; i >= 0; i--) {
      const m = s.meteors[i];
      m.t += dt;
      m.x += m.vx * dt;
      m.y += m.vy * dt;
      if (m.t > 2.4) s.meteors.splice(i, 1);
    }
    s.flags += dt;
    // sun and moon follow the viewport's sky
    const vyT = clamp(
      E.sy - c.t + E.H * 0.22,
      SUN_REACH + 6,
      Math.max(SUN_REACH + 10, hz - 120),
    );
    const sunUp = sm(0.3, 1, D),
      moonUp = sm(0.55, 0, D);
    s.sun.x = clamp(w * 0.72, SUN_REACH, Math.max(SUN_REACH, w - SUN_REACH));
    s.sun.y = lerp(hz + 30, vyT, sunUp);
    s.sun.up = sunUp;
    s.moon.x = clamp(w * 0.3, MOON_REACH, Math.max(MOON_REACH, w - MOON_REACH));
    s.moon.y = lerp(hz + 30, vyT + 30, moonUp);
    s.moon.up = moonUp;
  },
  draw(c: Col, s: State): void {
    const D = E.day,
      u = s.u,
      w = c.w,
      h = c.h,
      hz = h - s.gh,
      t = s.clk,
      v0 = c.v0,
      v1 = c.v1;
    const par = (E.sy - c.t) * 0.05;
    // stars
    const sa = sm(0.5, 0, D);
    if (sa > 0.02) {
      const near: Pt[] = [];
      for (const st of s.stars) {
        const y = st.y + par;
        if (y < v0 - 20 || y > v1 + 20) continue;
        const tw = (0.75 + 0.25 * Math.sin(t * 0.8 + st.ph)) * sa;
        let boost = 0;
        if (c.mIn) {
          const d = Math.hypot(st.x - c.mx, y - c.my);
          if (d < 150) {
            boost = 1 - d / 150;
            near.push([st.x, y]);
          }
        }
        LW.star(
          st.x,
          y,
          st.r * (1 + boost * 0.6),
          Math.min(1, tw + boost * 0.5),
          st.big || boost > 0.5,
        );
      }
      // pointer draws a small constellation: the nearest stars joined into one path
      if (near.length > 1) {
        near.sort(
          (a, b) =>
            Math.hypot(a[0] - c.mx, a[1] - c.my) -
            Math.hypot(b[0] - c.mx, b[1] - c.my),
        );
        const ch = near.slice(0, 6);
        g.beginPath();
        ch.forEach((q, i) => (i ? g.lineTo(q[0], q[1]) : g.moveTo(q[0], q[1])));
        ink(0.6 * sa, 1.3);
      }
    }
    // moon
    if (s.moon.up > 0.02) {
      const mx = s.moon.x,
        my = s.moon.y,
        r = 24 * u;
      const a = s.moon.up;
      g.beginPath();
      g.arc(mx, my, r, 0, TAU);
      fillP();
      ink(0.9 * a, 1.8);
      g.save();
      g.beginPath();
      g.arc(mx, my, r, 0, TAU);
      g.clip();
      g.beginPath();
      g.arc(mx + r * 0.5, my - r * 0.18, r * 0.86, 0, TAU);
      fillP();
      ink(0.7 * a, 1.4);
      g.restore();
      g.beginPath();
      g.arc(mx, my, r + 9, 0, TAU);
      ink(0.18 * a, 1.2);
      g.beginPath();
      g.arc(mx, my, r + 19, 0, TAU);
      ink(0.1 * a, 1.2);
    }
    // sun with rays and a halo that fades to dusk lines
    if (s.sun.up > 0.02) {
      const sx = s.sun.x,
        sy = s.sun.y,
        r = 26 * u,
        a = sm(0.0, 0.25, s.sun.up);
      g.beginPath();
      g.arc(sx, sy, r, 0, TAU);
      fillP();
      ink(0.95 * a, 2);
      g.beginPath();
      g.arc(sx, sy, r * 0.62, 0, TAU);
      ink(0.45 * a, 1.2);
      g.beginPath();
      for (let i = 0; i < 16; i++) {
        const an = (i * TAU) / 16 + t * 0.15,
          r0 = r + 8,
          r1 = r + (i % 2 ? 15 : 24) * u;
        g.moveTo(sx + Math.cos(an) * r0, sy + Math.sin(an) * r0);
        g.lineTo(sx + Math.cos(an) * r1, sy + Math.sin(an) * r1);
      }
      ink(0.85 * a, 1.8);
      if (D < 0.85) {
        const dusk = sm(0.85, 0.3, D);
        for (let i = 0; i < 3; i++) {
          g.beginPath();
          g.arc(sx, sy, r + 38 * u + i * 16 * u, PI * 0.95, PI * 2.05);
          ink(0.35 * dusk * a, 1.3);
        }
      }
    }
    // clouds
    const ca = sm(0.08, 0.75, D) * 0.9;
    if (ca > 0.02) {
      g.globalAlpha = ca;
      for (const cl of s.clouds) {
        const y = cl.y + par * 1.6;
        if (y < v0 - 50 || y > v1 + 50) continue;
        g.globalAlpha = ca * edgeFade(cl.x, w, CLOUD_REACH * 0.5);
        LW.cloud(cl.x, y, cl.sz);
      }
      g.globalAlpha = 1;
    }
    // birds
    const ba = sm(0.5, 0.8, D);
    if (ba > 0.02) {
      g.globalAlpha = ba;
      for (const b of s.birds) {
        if (b.y < v0 - 30 || b.y > v1 + 30) continue;
        g.globalAlpha = ba * edgeFade(b.x, w, BIRD_REACH);
        LW.bird(b.x, b.y, b.fl, b.sz, false);
      }
      g.globalAlpha = 1;
    }
    // bats at dusk
    const dk = Math.max(0, 1 - Math.abs(D - 0.38) / 0.28);
    if (dk > 0.02) {
      g.globalAlpha = dk;
      for (const b of s.bats) {
        if (b.y < v0 - 30 || b.y > v1 + 30) continue;
        g.globalAlpha = dk * edgeFade(b.x, w, BAT_REACH);
        LW.bird(b.x, b.y, b.fl, b.sz, true);
      }
      g.globalAlpha = 1;
    }
    // far ridge
    const rp: Pt[] = [[-10, h]];
    for (let i = 0; i < s.ridge.length; i++)
      rp.push([i * 14 - 6, hz + 36 * u + s.ridge[i]]);
    rp.push([w + 10, h]);
    g.beginPath();
    g.moveTo(rp[0]![0], rp[0]![1]);
    for (let i = 1; i < rp.length; i++) g.lineTo(rp[i]![0], rp[i]![1]);
    g.closePath();
    fillP();
    g.beginPath();
    for (let i = 1; i < rp.length - 1; i++) {
      if (i === 1) g.moveTo(rp[i]![0], rp[i]![1]);
      else g.lineTo(rp[i]![0], rp[i]![1]);
    }
    {
      const fg = g.createLinearGradient(0, 0, w, 0);
      fg.addColorStop(0, SA(0));
      fg.addColorStop(0.1, SA(0.6));
      fg.addColorStop(0.9, SA(0.6));
      fg.addColorStop(1, SA(0));
      g.strokeStyle = fg;
      g.lineWidth = 1;
      g.stroke();
    }
    // skyline
    const base = h - 2;
    s.houses.forEach((hh: State) => {
      const x = hh.x,
        top = base - hh.ht;
      g.beginPath();
      g.rect(x, top, hh.wd, hh.ht + 2);
      fillP();
      ink(0.9, 1.7);
      g.beginPath();
      g.moveTo(x - 2, top);
      g.lineTo(x + hh.wd + 2, top);
      ink(0.95, 2.1);
      if (hh.kind > 0.8) {
        g.beginPath();
        g.moveTo(x + hh.wd * 0.3, top);
        g.lineTo(x + hh.wd * 0.3, top - 16 * u);
        g.moveTo(x + hh.wd * 0.3 - 6 * u, top - 11 * u);
        g.lineTo(x + hh.wd * 0.3 + 6 * u, top - 11 * u);
        ink(0.7, 1.2);
      } else if (hh.kind < 0.2) {
        g.beginPath();
        g.rect(x + hh.wd * 0.55, top - 12 * u, 9 * u, 12 * u);
        ink(0.8, 1.4);
      }
      for (const wn of hh.wins) {
        const lit = wn.thr < sm(0.8, 0.15, D) * 1.0;
        const fl = lit ? 0.9 + 0.1 * Math.sin(t * 0.9 + wn.ph) : 0;
        g.beginPath();
        g.rect(wn.x, base + wn.y, 6 * u, 9 * u);
        if (lit) {
          fillS(fl * 0.9);
          ink(0.9, 1);
        } else ink(0.55, 1.1);
      }
    });
    // stupa + prayer flags on the skyline
    {
      const sx = w * 0.74,
        by = base - 14 * u,
        r = 34 * u;
      g.beginPath();
      g.rect(sx - r * 1.5, by - 8 * u, r * 3, 10 * u);
      fillP();
      ink(0.9, 1.7);
      g.beginPath();
      g.moveTo(sx - r, by - 8 * u);
      g.bezierCurveTo(
        sx - r,
        by - r * 1.5,
        sx + r,
        by - r * 1.5,
        sx + r,
        by - 8 * u,
      );
      g.closePath();
      fillP();
      ink(0.95, 1.9);
      g.beginPath();
      g.rect(sx - 9 * u, by - r * 1.18 - 12 * u, 18 * u, 12 * u);
      fillP();
      ink(0.95, 1.7);
      g.beginPath();
      g.moveTo(sx, by - r * 1.18 - 12 * u);
      g.lineTo(sx, by - r * 1.18 - 34 * u);
      ink(0.95, 1.8);
      const litEye = D < 0.4;
      g.beginPath();
      g.arc(sx - 3.5 * u, by - r * 1.18 - 6 * u, 1.7 * u, 0, TAU);
      g.arc(sx + 3.5 * u, by - r * 1.18 - 6 * u, 1.7 * u, 0, TAU);
      if (litEye) fillS(1);
      else ink(0.9, 1.1);
      for (let k = 0; k < 2; k++) {
        const ex = sx + (k ? 1 : -1) * r * 2,
          ey = base - 8 * u,
          ty = by - r * 1.18 - 34 * u;
        g.beginPath();
        g.moveTo(sx, ty);
        g.quadraticCurveTo((sx + ex) / 2, (ty + ey) / 2 + 14 * u, ex, ey);
        ink(0.6, 1.1);
        for (let i = 1; i < 6; i++) {
          const q = i / 6,
            fx = lerp(sx, ex, q),
            fy = lerp(ty, ey, q) + Math.sin(q * PI) * 10 * u,
            fl = Math.sin(t * 5 + i + k * 2) * 2;
          g.beginPath();
          g.moveTo(fx - 3, fy);
          g.lineTo(fx + 3, fy);
          g.lineTo(fx + 3 + fl * 0.4, fy + 8);
          g.lineTo(fx - 3 + fl * 0.4, fy + 8);
          g.closePath();
          if (i % 2) fillS(0.6);
          else ink(0.8, 1);
        }
      }
    }
    // lanterns
    for (const l of s.lanterns) {
      if (l.y < v0 - 60 || l.y > v1 + 60) continue;
      const fl = 0.92 + 0.08 * Math.sin(t * 2.5 + l.ph);
      g.globalAlpha = sm(0, 90, l.y) * edgeFade(l.x, w, 34);
      glow(l.x, l.y, 46 * l.sz, 0.32 * fl);
      g.save();
      g.translate(l.x, l.y);
      g.scale(l.sz, l.sz);
      g.rotate(Math.sin(l.t * 0.8 + l.ph) * 0.08);
      g.beginPath();
      g.moveTo(-8, -18);
      g.quadraticCurveTo(-16, 0, -12, 16);
      g.lineTo(12, 16);
      g.quadraticCurveTo(16, 0, 8, -18);
      g.closePath();
      fillP();
      ink(0.95, 1.8);
      g.beginPath();
      g.moveTo(-9, -8);
      g.quadraticCurveTo(0, -5, 9, -8);
      g.moveTo(-12, 6);
      g.quadraticCurveTo(0, 9, 12, 6);
      ink(0.5, 1.1);
      g.beginPath();
      g.moveTo(-6, 16);
      g.lineTo(-6, 20);
      g.moveTo(6, 16);
      g.lineTo(6, 20);
      g.moveTo(-6, 20);
      g.lineTo(6, 20);
      ink(0.8, 1.3);
      g.beginPath();
      g.ellipse(0, 12, 4, 6 * fl, 0, 0, TAU);
      fillS(0.95);
      g.restore();
      g.globalAlpha = 1;
    }
    // fireflies
    const fa = sm(0.4, 0, D);
    if (fa > 0.02) {
      for (const f of s.flies) {
        if (f.y < v0 - 40 || f.y > v1 + 40) continue;
        const tw =
          (0.65 + 0.35 * Math.sin(t * 1.2 + f.ph * 5)) *
          fa *
          (f.temp ? Math.min(1, f.life) : 1) *
          edgeFade(f.x, w, FLY_REACH);
        glow(f.x, f.y, 12, 0.25 * tw);
        circ(f.x, f.y, 1.6);
        fillS(0.7 * (0.4 + 0.6 * tw));
      }
    }
    // meteors
    for (const m of s.meteors) {
      const a = Math.sin(clamp(m.t / 2.4, 0, 1) * PI);
      const L = 60,
        n = Math.hypot(m.vx, m.vy);
      g.beginPath();
      g.moveTo(m.x, m.y);
      g.lineTo(m.x - (m.vx / n) * L, m.y - (m.vy / n) * L);
      ink(0.9 * a, 2);
      circ(m.x, m.y, 2.4);
      fillS(a);
    }
  },
};
