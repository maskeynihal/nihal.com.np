/* eslint-disable */
// @ts-nocheck
/**
 * The climb (section art for the CV): a line-drawn Himalayan mountain for the whole height of the column,
 * a winding trail with switchbacks from a small village at the bottom to a summit near the top, tea houses
 * and cairns along it marking stages (no text), prayer flags at the summit. A tiny trekker walks the trail
 * with the page: progress follows the scroll position through the section, so it climbs when you scroll
 * down, descends when you scroll up, rests when you stop, and the cairn it stands at lights softly. A click
 * plants a small flag on the nearest point of the trail (at most 5). Idle life is quiet: flags stirring,
 * one slow cloud, smoke from the tea houses. At the low lamp levels the windows are lit and a few faint
 * stars show above the summit.
 */
import { E, g, SA, PG, ink, fillS, fillP, PL, glow, circ, clamp, lerp, sm, rnd, mulberry, TAU, PI } from './core';

/**
 * Largest extents (px) of everything that moves or has a body, used to keep it inside the safe rect: the
 * trekker with pack and stick, a tea house (with its chimney), a planted flag, the summit flags, the cloud.
 * The trail itself is kept TRAIL_INSET from either side so a house beside it fits whole.
 */
export const TREK_REACH = 26;
export const STATION_REACH = 38;
export const FLAG_REACH = 18;
export const CLOUD_REACH = 70;
export const TRAIL_INSET = 52;
export const MAX_FLAGS = 5;
const SUMMIT_Y = 112; // the summit's peak: flags reach about 60 px above it, stars a little more

const ease = (x) => { x = clamp(x, 0, 1); return x * x * (3 - 2 * x); };

function teaHouse(x, y, lit, smokeT) {
  // a stone tea house: pitched roof, door, one window that lights at the low lamp levels, chimney and a wisp
  g.beginPath(); g.rect(x - 14, y - 16, 28, 16); fillP(); ink(0.9, 1.5);
  g.beginPath(); g.moveTo(x - 18, y - 16); g.lineTo(x, y - 30); g.lineTo(x + 18, y - 16); g.closePath(); fillP(); ink(0.95, 1.5);
  g.beginPath(); g.rect(x + 8, y - 36, 5, 9); fillP(); ink(0.8, 1.2);
  g.beginPath(); g.rect(x - 9, y - 11, 6, 11); ink(0.8, 1.2);
  g.beginPath(); g.rect(x + 3, y - 12, 7, 6); if (lit > 0.02) { g.globalAlpha = lit; fillS(0.9); g.globalAlpha = 1; } ink(0.85, 1.1);
  g.beginPath();
  for (let i = 0; i < 2; i++) { const o = (smokeT * 5 + i * 14) % 28; g.moveTo(x + 10 + Math.sin(o * 0.3) * 3, y - 38 - o); g.lineTo(x + 10 + Math.sin((o + 5) * 0.3) * 3, y - 38 - o - 6); }
  ink(0.4, 1);
}
function cairn(x, y, big, lit, t) {
  // stacked stones, a little prayer-flag stick on the big one
  const n = big ? 4 : 3;
  for (let i = 0; i < n; i++) {
    const w = (big ? 15 : 12) - i * 2.6, h = 5 - i * 0.3, yy = y - i * (h * 1.7);
    g.beginPath(); g.ellipse(x + (i % 2 ? 1.5 : -1.5), yy - h, w, h, 0, 0, TAU); fillP(); ink(0.9, 1.4);
  }
  if (big) { g.beginPath(); g.moveTo(x, y - n * 8.5); g.lineTo(x, y - n * 8.5 - 20); ink(0.9, 1.4); }
}
function station(st, lit, D, t) {
  if (lit > 0.02) glow(st.x, st.y - 12, 30, 0.5 * lit);
  const win = sm(0.62, 0.2, D); // windows are lit when the lamp is low
  if (st.kind === 'tea') teaHouse(st.x, st.y, win, t);
  else cairn(st.x, st.y, st.kind === 'summit', lit, t);
}
function flagPole(x, y, h, t, ph, grow) {
  const hh = h * ease(grow);
  g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - hh); ink(0.9, 1.3);
  if (hh > 8) {
    const fl = Math.sin(t * 1.4 + ph) * 1.6 * ease(grow);
    g.beginPath(); g.moveTo(x, y - hh); g.lineTo(x + 11 + fl, y - hh + 3 + fl * 0.4); g.lineTo(x + 1, y - hh + 8); g.closePath(); fillP(); ink(0.9, 1.1);
  }
}
function trekker(x, y, face, ph, moving, t) {
  // a tiny trekker: pack, stick, striding legs; at rest it leans on the stick
  const sw = Math.sin(ph) * 5 * moving, br = Math.sin(t * 1.2) * 0.4;
  g.save(); g.translate(x, y); g.scale(face * 1.15, 1.15);
  g.beginPath(); g.moveTo(0, -11); g.lineTo(sw, 0); g.moveTo(0, -11); g.lineTo(-sw, 0); ink(0.95, 1.4);
  g.beginPath(); g.moveTo(0, -11); g.lineTo(1 + br * 0.3, -21); ink(0.95, 1.6);
  g.beginPath(); g.moveTo(-1, -20); g.lineTo(-8, -19); g.lineTo(-9, -9); g.lineTo(-2, -9); g.closePath(); fillP(); ink(0.9, 1.3);
  g.beginPath(); g.arc(1.5, -25, 3.3, 0, TAU); fillP(); ink(0.95, 1.4);
  g.beginPath(); g.moveTo(1.5, -15); g.lineTo(6, -13); g.lineTo(8 + sw * 0.25, 0); ink(0.9, 1.3);
  g.restore();
}
function cloud(x, y, sz) {
  g.beginPath(); g.moveTo(x - 46 * sz, y); g.bezierCurveTo(x - 58 * sz, y, x - 58 * sz, y - 20 * sz, x - 38 * sz, y - 20 * sz);
  g.bezierCurveTo(x - 36 * sz, y - 38 * sz, x - 8 * sz, y - 40 * sz, x - 2 * sz, y - 24 * sz);
  g.bezierCurveTo(x + 10 * sz, y - 38 * sz, x + 36 * sz, y - 30 * sz, x + 32 * sz, y - 14 * sz);
  g.bezierCurveTo(x + 52 * sz, y - 16 * sz, x + 56 * sz, y, x + 40 * sz, y); g.closePath(); fillP(); ink(0.85, 1.4);
  g.beginPath(); g.moveTo(x - 30 * sz, y - 6 * sz); g.lineTo(x + 26 * sz, y - 6 * sz); ink(0.4, 1);
}
/** Quadratic-through-midpoints curve sampled to a polyline with arc length. */
function sampleTrail(P) {
  const xs = [P[0][0]], ys = [P[0][1]], ls = [0];
  const add = (x, y) => { ls.push(ls[ls.length - 1] + Math.hypot(x - xs[xs.length - 1], y - ys[ys.length - 1])); xs.push(x); ys.push(y); };
  let px = P[0][0], py = P[0][1];
  for (let i = 1; i < P.length - 1; i++) {
    const mx = (P[i][0] + P[i + 1][0]) / 2, my = (P[i][1] + P[i + 1][1]) / 2;
    const sx = i === 1 ? P[0][0] : (P[i - 1][0] + P[i][0]) / 2, sy = i === 1 ? P[0][1] : (P[i - 1][1] + P[i][1]) / 2;
    for (let k = 1; k <= 9; k++) {
      const u = k / 9, a = (1 - u) * (1 - u), b = 2 * (1 - u) * u, c2 = u * u;
      add(a * sx + b * P[i][0] + c2 * mx, a * sy + b * P[i][1] + c2 * my);
    }
    px = mx; py = my;
  }
  add(P[P.length - 1][0], P[P.length - 1][1]);
  return { xs, ys, ls, total: ls[ls.length - 1] };
}
function trailAt(tr, l) {
  const L = tr.ls; let lo = 0, hi = L.length - 1; l = clamp(l, 0, tr.total);
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (L[m] < l) lo = m; else hi = m; }
  const f = (l - L[lo]) / ((L[hi] - L[lo]) || 1);
  const tx = tr.xs[hi] - tr.xs[lo], ty = tr.ys[hi] - tr.ys[lo], tl = Math.hypot(tx, ty) || 1;
  return [lerp(tr.xs[lo], tr.xs[hi], f), lerp(tr.ys[lo], tr.ys[hi], f), tx / tl, ty / tl];
}

export const climb = {
  init(c) {
    const w = c.w, h = c.h, rg = mulberry(c.seed * 41 + 3);
    const sx = w * 0.5, ytop = SUMMIT_Y, ybot = h - 56;
    // The mountain: half-width grows from the summit to the base, a little irregular; everything inside the safe rect.
    const maxHalf = w / 2 - 16;
    const ph1 = rg() * 6, ph2 = rg() * 6;
    const hw = (y) => {
      const t = clamp((y - ytop) / (ybot - ytop), 0, 1);
      return maxHalf * (0.04 + 0.96 * Math.pow(t, 0.78)) * (1 + 0.06 * Math.sin(y * 0.031 + ph1) + 0.045 * Math.sin(y * 0.073 + ph2));
    };
    // The trail: switchbacks from the village up to just under the summit, always inside the trail inset.
    const n = Math.max(5, Math.round((ybot - ytop) / 165));
    const P = [[sx - 14, h - 26]];
    for (let k = 1; k <= n; k++) {
      const y = lerp(h - 40, ytop + 26, k / n), half = Math.max(0, Math.min(hw(y) * 0.78, w / 2 - TRAIL_INSET));
      const x = k === n ? sx + 6 : sx + (k % 2 ? 1 : -1) * half * (0.82 + rg() * 0.18);
      P.push([x, y]);
    }
    const trail = sampleTrail(P);
    // Stages: tea house, cairn, tea house, cairn, then the summit cairn. Set a little inside the trail.
    const stations = [];
    [[0.17, 'tea'], [0.38, 'cairn'], [0.58, 'tea'], [0.79, 'cairn'], [1, 'summit']].forEach(([f, kind]) => {
      const p = trailAt(trail, trail.total * f), dir = Math.sign(sx - p[0]) || 1;
      const x = clamp(p[0] + dir * (kind === 'summit' ? 0 : 18), STATION_REACH, w - STATION_REACH);
      stations.push({ l: trail.total * f, x, y: p[1] + (kind === 'summit' ? 0 : 1), kind, lit: 0 });
    });
    // Village: small houses along the bottom, inside the sides.
    const houses = [];
    for (let x = sx - maxHalf * 0.8; x < sx + maxHalf * 0.8 - 20;) {
      const wd = 22 + rg() * 16, ht = 14 + rg() * 14;
      if (x + wd > sx + maxHalf * 0.8) break;
      houses.push({ x, wd, ht, roof: rg() < 0.6, win: rg(), thr: rg() });
      x += wd + 4 + rg() * 8;
    }
    // Trees: tiny pines low on the flanks.
    const pines = Array.from({ length: 7 }, () => { const y = ybot - 20 - rg() * (ybot - ytop) * 0.4; return { y, x: sx + (rg() < 0.5 ? -1 : 1) * hw(y) * (0.55 + rg() * 0.3), s: 0.7 + rg() * 0.5 }; });
    const stars = Array.from({ length: 9 }, () => ({ x: sx + (rg() - 0.5) * w * 0.7, y: 26 + rg() * (ytop - 40), r: 0.9 + rg() * 0.9, ph: rg() * 9 }));
    return { w, h, sx, ytop, ybot, hw, trail, stations, houses, pines, stars, flags: [], pos: 0, face: 1, gait: 0, ph: 0, moving: 0, clk: 0, cloud: { x: w * 0.2, y: ytop + (ybot - ytop) * 0.34, sz: 0.9 }, wind: rg() * 9 };
  },
  tap(c, s, x, y) {
    // plant a flag on the nearest point of the trail
    let best = 0, bd = 1e9;
    for (let i = 0; i < s.trail.xs.length; i++) { const d = Math.hypot(s.trail.xs[i] - x, s.trail.ys[i] - y); if (d < bd) { bd = d; best = i; } }
    s.flags.push({ l: s.trail.ls[best], t0: s.clk, ph: Math.random() * 9 });
    if (s.flags.length > MAX_FLAGS) s.flags.shift();
  },
  update(c, s, dt) {
    s.clk += dt;
    const target = clamp(c.prog, 0, 1) * s.trail.total;
    const diff = target - s.pos;
    if (E.reduced) s.pos = target;
    else if (Math.abs(diff) > 1) {
      const sp = Math.min(110, 16 + Math.abs(diff) * 0.7), step = Math.sign(diff) * Math.min(Math.abs(diff), sp * dt);
      s.pos += step;
      s.moving += (1 - s.moving) * Math.min(1, dt * 5);
      s.ph += dt * (sp / 18 + 2);
      const p = trailAt(s.trail, s.pos);
      const dirx = p[2] * Math.sign(step);
      if (Math.abs(dirx) > 0.12) s.face = dirx > 0 ? 1 : -1;
    } else s.moving += (0 - s.moving) * Math.min(1, dt * 4);
    // the cairn or house the trekker stands at lights softly, the others ease dark
    for (const st of s.stations) {
      const near = Math.abs(st.l - s.pos) < 60 ? 1 : 0;
      st.lit += (near - st.lit) * Math.min(1, dt * 1.2);
    }
    // one slow cloud
    s.cloud.x += 3.5 * dt;
    if (s.cloud.x > s.w + CLOUD_REACH) s.cloud.x = -CLOUD_REACH;
  },
  draw(c, s) {
    const t = s.clk, w = c.w, h = c.h, D = E.day, sx = s.sx, ytop = s.ytop, ybot = s.ybot, hw = s.hw;
    const edge = (x, r) => Math.min(sm(0, 2 * r + 20, x), sm(0, 2 * r + 20, w - x));
    // stars above the summit, faint, at the low lamp levels
    const sa = sm(0.45, 0, D);
    if (sa > 0.02) for (const st of s.stars) { circ(st.x, st.y, st.r); fillS(sa * (0.55 + 0.2 * Math.sin(t * 0.7 + st.ph))); }
    // one slow cloud behind the ridge
    if (s.cloud.y > c.v0 - 60 && s.cloud.y < c.v1 + 60) { g.globalAlpha = edge(s.cloud.x, CLOUD_REACH * 0.5) * 0.9; cloud(s.cloud.x, s.cloud.y, s.cloud.sz); g.globalAlpha = 1; }
    // the mountain: two flanks meeting at the summit, filled so the cloud passes behind
    const L = [], R = [];
    for (let y = ytop; y <= ybot + 0.1; y += 14) { L.push([sx - hw(y), y]); R.push([sx + hw(y), y]); }
    g.beginPath(); L.forEach((p, i) => (i ? g.lineTo(p[0], p[1]) : g.moveTo(p[0], p[1]))); for (let i = R.length - 1; i >= 0; i--) g.lineTo(R[i][0], R[i][1]); g.closePath(); fillP();
    g.beginPath(); PL(L, 7, 1.4); ink(0.85, 1.3);
    g.beginPath(); PL(R, 9, 1.4); ink(0.85, 1.3);
    // shading on the right flank, short and faint
    g.beginPath();
    for (let y = ytop + 34; y < ybot - 70; y += 17) { const x = sx + hw(y), len = 9 + 16 * ((y - ytop) / (ybot - ytop)); g.moveTo(x - 1, y); g.lineTo(x - len * 0.55, y + len); }
    ink(0.35, 1);
    // snow line: a jagged band across the top
    { const ys = ytop + (ybot - ytop) * 0.17, a = sx - hw(ys) * 0.94, b = sx + hw(ys) * 0.94, pts = [];
      for (let i = 0; i <= 9; i++) pts.push([lerp(a, b, i / 9), ys + (i % 2 ? 11 : -3)]);
      g.beginPath(); PL(pts, 3, 0.6); ink(0.55, 1.1); }
    // pines
    for (const p of s.pines) { if (p.y < c.v0 - 30 || p.y > c.v1 + 30) continue;
      g.beginPath(); g.moveTo(p.x, p.y); g.lineTo(p.x, p.y - 8 * p.s); g.moveTo(p.x - 6 * p.s, p.y - 8 * p.s); g.lineTo(p.x, p.y - 22 * p.s); g.lineTo(p.x + 6 * p.s, p.y - 8 * p.s); g.closePath(); ink(0.7, 1.1); }
    // the trail, dashed
    g.beginPath(); g.setLineDash([6, 5]); g.moveTo(s.trail.xs[0], s.trail.ys[0]);
    for (let i = 1; i < s.trail.xs.length; i++) g.lineTo(s.trail.xs[i], s.trail.ys[i]);
    ink(0.7, 1.2); g.setLineDash([]);
    // village
    { const base = h - 12, win = sm(0.62, 0.2, D);
      const fg = g.createLinearGradient(sx - hw(ybot) , 0, sx + hw(ybot), 0);
      fg.addColorStop(0, SA(0)); fg.addColorStop(0.1, SA(0.9)); fg.addColorStop(0.9, SA(0.9)); fg.addColorStop(1, SA(0));
      for (const hs of s.houses) {
        g.beginPath(); g.rect(hs.x, base - hs.ht, hs.wd, hs.ht); fillP(); ink(0.9, 1.4);
        if (hs.roof) { g.beginPath(); g.moveTo(hs.x - 2, base - hs.ht); g.lineTo(hs.x + hs.wd / 2, base - hs.ht - 8); g.lineTo(hs.x + hs.wd + 2, base - hs.ht); ink(0.9, 1.3); }
        else { g.beginPath(); g.moveTo(hs.x - 1, base - hs.ht); g.lineTo(hs.x + hs.wd + 1, base - hs.ht); ink(0.95, 1.6); }
        g.beginPath(); g.rect(hs.x + 5, base - hs.ht + 4, 5, 5); if (hs.thr < win) { fillS(0.85); } ink(0.8, 1);
      }
      g.beginPath(); g.moveTo(sx - maxX(s), base); g.lineTo(sx + maxX(s), base); g.strokeStyle = fg; g.lineWidth = 1.2; g.stroke(); }
    // tea houses and cairns
    for (const st of s.stations) { if (st.y < c.v0 - 70 || st.y > c.v1 + 40) continue; station(st, st.lit, D, t); }
    // the summit flags: two strings of small flags stirring slowly
    { const top = s.stations[s.stations.length - 1], px = top.x, py = top.y - 4 * 8.5 - 20;
      for (const sd of [-1, 1]) {
        const ex = clamp(px + sd * 62, FLAG_REACH, w - FLAG_REACH), ey = py + 38;
        g.beginPath(); g.moveTo(px, py); g.quadraticCurveTo((px + ex) / 2, (py + ey) / 2 + 8, ex, ey); ink(0.6, 1);
        for (let i = 1; i < 7; i++) { const q = i / 7, fx = lerp(px, ex, q), fy = lerp(py, ey, q) + Math.sin(q * PI) * 8, fl = Math.sin(t * 1.3 + i + sd) * 1.6;
          g.beginPath(); g.moveTo(fx - 3, fy); g.lineTo(fx + 3, fy); g.lineTo(fx + 3 + fl * 0.4, fy + 8); g.lineTo(fx - 3 + fl * 0.4, fy + 8); g.closePath(); if (i % 2) fillS(0.55); else { fillP(); ink(0.8, 1); } }
      } }
    // planted flags
    for (const f of s.flags) { const p = trailAt(s.trail, f.l); flagPole(p[0] + 4, p[1], 24, t, f.ph, (t - f.t0) / 0.9); }
    // the trekker
    { const p = trailAt(s.trail, s.pos); trekker(p[0], p[1], s.face, s.ph, s.moving, t); }
  },
};
const maxX = (s) => s.hw(s.ybot) * 0.82;
