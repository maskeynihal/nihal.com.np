import { type Ball, type Colors, type World, TAU, clamp } from './core';

export interface Dog {
  x: number;
  y: number;
  f: number;
  type: number;
  size: number;
  state: 'idle' | 'wander' | 'go' | 'back';
  ball: Ball | null;
  tx: number;
  ty: number;
  timer: number;
  phase: number;
  speed: number;
  sniff: number;
  joy: number;
  seed: number;
}

export function spawnDogs(w: World): Dog[] {
  return [
    { type: 0, size: 1.9, x: w.W * 0.3, seed: 0 },
    { type: 1, size: 1.5, x: w.W * 0.68, seed: 2 },
  ].map((d) => ({
    ...d,
    y: (w.g0 + w.g1) / 2 + d.seed * 8,
    f: d.type ? -1 : 1,
    state: 'idle' as const,
    ball: null,
    tx: 0,
    ty: 0,
    timer: 1 + d.seed,
    phase: 0,
    speed: 0,
    sniff: 0,
    joy: 0,
  }));
}

const dist = (ax: number, ay: number, bx: number, by: number) =>
  Math.hypot(ax - bx, ay - by);

/** Hands each loose ball to the nearest idle dog. */
function assign(w: World, dogs: Dog[]) {
  for (const b of w.balls) {
    if (b.claimed) continue;
    let best: Dog | null = null;
    for (const d of dogs) {
      if (d.state === 'go' || d.state === 'back') continue;
      if (!best || dist(d.x, d.y, b.x, b.y) < dist(best.x, best.y, b.x, b.y))
        best = d;
    }
    if (best) {
      b.claimed = true;
      best.ball = b;
      best.state = 'go';
    }
  }
}

export function stepDogs(w: World, dogs: Dog[], dt: number) {
  assign(w, dogs);
  for (const d of dogs) {
    if (d.ball && !w.balls.includes(d.ball)) {
      d.ball = null;
      d.state = 'idle';
    }
    d.timer -= dt;
    d.joy = Math.max(0, d.joy - dt);
    d.sniff = clamp(
      d.sniff +
        (d.state === 'idle' && d.timer < 0 && d.timer > -1.6 ? dt : -dt) * 4,
      0,
      1,
    );
    let speed = 0;
    if (d.state === 'idle') {
      if (d.timer < -1.6) {
        d.timer = 2 + Math.random() * 3;
        if (Math.random() < 0.5) {
          d.state = 'wander';
          d.tx = 40 + Math.random() * (w.W - 80);
          d.ty = w.g0 + 20 + Math.random() * (w.g1 - w.g0 - 20);
        }
      }
    } else if (d.state === 'wander') {
      speed = 85;
    } else if (d.state === 'go' && d.ball) {
      d.tx = d.ball.x;
      d.ty = d.ball.y;
      speed = 300;
      if (dist(d.x, d.y, d.tx, d.ty) < 16 && d.ball.z < 18) {
        d.ball.held = true;
        d.state = 'back';
        const side = (d.type ? 1 : -1) * 70 * d.size;
        d.ball.rx = w.hover ? w.px + side : d.ball.rx;
        d.ball.ry = w.hover ? w.py : d.ball.ry;
      }
    } else if (d.state === 'back') {
      speed = 230;
      const b = d.ball!;
      d.tx = b.rx;
      d.ty = clamp(b.ry, w.g0 + 14, w.g1);
      if (dist(d.x, d.y, d.tx, d.ty) < 24) {
        b.held = false;
        b.done = 0;
        b.x = d.x + d.f * 40 * d.size;
        b.y = d.y;
        b.z = 14;
        b.vz = 220;
        b.vx = d.f * 30;
        d.ball = null;
        d.state = 'idle';
        d.timer = 1.4;
        d.joy = 2.2;
        speed = 0;
      }
    }
    if (speed) {
      const dx = d.tx - d.x;
      const dy = (d.ty - d.y) * 1.6;
      const l = Math.hypot(dx, dy);
      if (d.state === 'wander' && l < 12) {
        d.state = 'idle';
        d.timer = 0.5 + Math.random() * 2;
      } else {
        const s = Math.min(speed, l * 6 + 40);
        d.x += (dx / l) * s * dt;
        d.y += (dy / l) * s * dt * 0.62;
        if (Math.abs(dx) > 6) d.f = dx > 0 ? 1 : -1;
        speed = s;
      }
    }
    d.x = clamp(d.x, 20, w.W - 20);
    d.y = clamp(d.y, w.g0, w.g1 + 6);
    d.speed += (speed - d.speed) * Math.min(1, dt * 10);
    d.phase += dt * d.speed * 0.048;
  }
}

/** Mouth position in screen space, for the ball a dog carries. */
export function mouth(d: Dog, t: number): [number, number] {
  const sc = scaleOf(d);
  const bob = d.speed > 150 ? Math.sin(d.phase * 2) * 2.5 : 0;
  void t;
  return [d.x + d.f * 47 * sc, d.y - (45 + bob) * sc];
}

export const scaleOf = (d: Dog) => d.size * (0.85 + (d.y / 400) * 0.25);

export function drawDog(
  c: CanvasRenderingContext2D,
  w: World,
  d: Dog,
  col: Colors,
) {
  const sc = scaleOf(d);
  const run = clamp((d.speed - 100) / 150, 0, 1);
  const moving = clamp(d.speed / 60, 0, 1);
  const wag = d.state === 'idle' || d.joy > 0 || d.state === 'back';
  const t = w.t;
  c.save();
  c.translate(d.x, d.y);
  // Shadow
  c.globalAlpha = 0.35;
  c.lineWidth = 1;
  c.strokeStyle = col.stroke;
  c.beginPath();
  c.ellipse(0, 1, 30 * sc, 4 * sc, 0, 0, TAU);
  c.stroke();
  c.globalAlpha = 1;
  c.scale(sc * d.f, sc);
  c.strokeStyle = col.stroke;
  c.fillStyle = col.page;
  c.lineWidth = 1.5 / sc;
  c.lineCap = 'round';
  c.lineJoin = 'round';

  const bob =
    moving *
    (run ? Math.sin(d.phase * 2) * 3 : Math.abs(Math.sin(d.phase)) * 1.5);
  const stride = 6 + run * 12;
  const lift = 3 + run * 9;
  const leg = (hx: number, ph: number, far: boolean) => {
    const hy = -25 + bob * 0.5;
    const fx = hx + Math.sin(ph) * stride * moving;
    const fy = -Math.max(0, -Math.cos(ph)) * lift * moving;
    const kx = (hx + fx) / 2 + (hx > 0 ? 3 : -3);
    c.globalAlpha = far ? 0.65 : 1;
    c.beginPath();
    c.moveTo(hx - 4.5, hy);
    c.quadraticCurveTo(kx - 3, (hy + fy) / 2, fx - 2.5, fy - 4);
    c.lineTo(fx - 2.5, fy);
    c.lineTo(fx + 5.5, fy);
    c.quadraticCurveTo(fx + 6, fy - 3, fx + 2.5, fy - 4);
    c.quadraticCurveTo(kx + 3, (hy + fy) / 2, hx + 4.5, hy);
    c.fill();
    c.stroke();
  };
  const a = d.phase;
  // [far front, far back, near front, near back]: trot in diagonal pairs, gallop in bunched pairs.
  const ph: [number, number, number, number] =
    run > 0.5
      ? [a + 0.35, a + 1.3, a, a + 0.95]
      : [a + Math.PI, a, a, a + Math.PI];
  leg(17, ph[0], true);
  leg(-17, ph[1], true);
  c.globalAlpha = 1;

  // Tail
  const ang =
    0.95 -
    (d.type ? 0.7 : 0) +
    (wag
      ? Math.sin(t * (d.joy > 0 ? 26 : 14) + d.seed) * (d.joy > 0 ? 0.55 : 0.3)
      : 0) -
    run * 0.45;
  const tl = d.type ? 20 : 30;
  const tx0 = -24;
  const ty0 = -40 + bob;
  c.beginPath();
  c.moveTo(tx0, ty0);
  c.quadraticCurveTo(
    tx0 - Math.cos(ang) * tl * 0.5 - 4,
    ty0 - Math.sin(ang) * tl * 0.7,
    tx0 - Math.cos(ang) * tl,
    ty0 - Math.sin(ang) * tl + (d.type ? 8 : 0),
  );
  c.stroke();

  // Body
  c.beginPath();
  c.moveTo(-25, -38 + bob);
  c.bezierCurveTo(-27, -56 + bob, 12, -56 + bob, 24, -50 + bob);
  c.bezierCurveTo(32, -36 + bob, 26, -20, 14, -22);
  c.bezierCurveTo(4, -18, -12, -18, -20, -23);
  c.bezierCurveTo(-30, -26, -29, -34, -25, -38 + bob);
  c.fill();
  c.stroke();
  if (d.type) {
    c.beginPath();
    c.ellipse(-6, -38 + bob, 6, 4, 0.3, 0, TAU);
    c.moveTo(10, -33 + bob);
    c.arc(8, -33 + bob, 2, 0, TAU);
    c.stroke();
  }

  // Head
  const dip = d.sniff * 13;
  const hx = 30 + d.sniff * 6;
  const hy = -56 + bob * 0.6 + dip - (d.state === 'back' ? 1 : 0);
  const tilt = d.sniff ? 0 : Math.sin(t * 0.9 + d.seed) * 0.05;
  c.save();
  c.translate(hx, hy);
  c.rotate(tilt + d.sniff * 0.35);
  c.beginPath();
  c.arc(0, 0, 11, 0, TAU);
  c.fill();
  c.stroke();
  c.beginPath();
  c.moveTo(6, -4);
  c.quadraticCurveTo(18, -6, 20, 1);
  c.quadraticCurveTo(19, 7, 8, 7);
  c.fill();
  c.stroke();
  c.beginPath();
  c.arc(20, -1, 2.2, 0, TAU);
  c.fillStyle = col.stroke;
  c.fill();
  c.beginPath();
  c.arc(4, -3, 1.5, 0, TAU);
  c.fill();
  c.fillStyle = col.page;
  if (run > 0.3 || d.joy > 0) {
    c.beginPath();
    c.moveTo(11, 6);
    c.quadraticCurveTo(14, 10 + Math.sin(t * 20) * 1.5, 16, 7);
    c.stroke();
  }
  // Ear: bounces with the stride, swings back at speed.
  const earA =
    0.35 +
    run * 0.9 +
    Math.sin(d.phase * (run ? 2 : 1) + 1) * 0.28 * moving +
    Math.sin(t * 2 + d.seed) * 0.04;
  c.save();
  c.translate(-3, -6);
  c.rotate(earA);
  c.beginPath();
  if (d.type) {
    c.moveTo(-5, 1);
    c.lineTo(-2, -15);
    c.lineTo(6, -1);
    c.rotate(0);
  } else {
    c.moveTo(0, 0);
    c.quadraticCurveTo(-11, 3, -7, 17);
    c.quadraticCurveTo(2, 18, 5, 3);
  }
  c.closePath();
  c.fill();
  c.stroke();
  c.restore();
  c.restore();
  // Collar
  if (!d.type) {
    c.beginPath();
    c.moveTo(21, -50 + bob + dip * 0.3);
    c.quadraticCurveTo(24, -42 + bob, 21, -34 + bob);
    c.stroke();
  }

  // near legs
  leg(17, ph[2], false);
  leg(-17, ph[3], false);
  c.restore();
}

export function drawBall(
  c: CanvasRenderingContext2D,
  b: Ball,
  col: Colors,
  held = false,
  at?: [number, number],
) {
  const fade = b.done > 8 ? Math.max(0, 1 - (b.done - 8) / 1.5) : 1;
  const r = 7 * (0.4 + 0.6 * fade);
  const sx = at ? at[0] : b.x;
  const sy = at ? at[1] : b.y - b.z - r;
  c.lineWidth = 1.5;
  c.strokeStyle = col.stroke;
  if (!held) {
    c.globalAlpha = 0.35 * fade;
    c.lineWidth = 1;
    c.beginPath();
    c.ellipse(
      b.x,
      b.y,
      r * (1.2 - Math.min(0.4, b.z / 200)),
      r * 0.4,
      0,
      0,
      TAU,
    );
    c.stroke();
    c.globalAlpha = fade;
    c.lineWidth = 1.5;
  }
  c.fillStyle = col.page;
  c.beginPath();
  c.arc(sx, sy, r, 0, TAU);
  c.fill();
  c.stroke();
  c.beginPath();
  c.arc(sx, sy, r, 0.4, 2.2);
  c.lineWidth = 1;
  c.stroke();
  c.globalAlpha = 1;
}
