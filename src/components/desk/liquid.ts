import {
  BufferGeometry,
  CylinderGeometry,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Vector3,
  type Color,
} from 'three';
import { lineArtMesh, type LineArt } from './line-art';

/**
 * The coffee in the mug, in the page's line art: a disc that sloshes when the mug is moved, drops
 * and a stream when it tips past 60 degrees, and a puddle (two wobbling outlines) that grows where
 * it lands and later fades. All code, no models. The disc lives inside the mug; the drops and the
 * puddle live in the table's group (world space).
 */
export interface Liquid {
  /** In world space: the drops and the puddle. Add to the table's group. */
  world: Group;
  /** Inside the mug: add to the mug's model root. */
  disc: Group;
  /** 0 empty to 1 full. */
  amount: number;
  /** Puddle radius (m), its centre, and seconds since it stopped growing (-1 while growing or none). */
  puddle: { r: number; at: Vector3; still: number; fade: number };
  slosh: { x: number; z: number; vx: number; vz: number };
  last: { p: Vector3; v: Vector3; ok: boolean };
  drops: { p: Vector3; v: Vector3; life: number }[];
  dropLines: LineSegments;
  blobs: [LineLoop, LineLoop];
  blobMaterial: LineBasicMaterial;
}

/** Tipped further than this and the coffee comes out (radians). */
export const SPILL_TILT = (60 * Math.PI) / 180;
export const PUDDLE_MAX = 0.11;
const FULL_Y = 0.071;
const EMPTY_Y = 0.028;
const DROPS = 28;

const ease = (u: number) => u * u * (3 - 2 * u);

function blob(n: number, wobble: number, seed: number): BufferGeometry {
  const pts: number[] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r =
      1 +
      wobble * Math.sin(a * 3 + seed) +
      wobble * 0.6 * Math.sin(a * 5 + seed * 2.3);
    pts.push(Math.cos(a) * r, 0, Math.sin(a) * r * 0.82);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pts, 3));
  return g;
}

export function buildLiquid(art: LineArt, stroke: Color): Liquid {
  const world = new Group();
  world.name = 'spill';
  const disc = new Group();
  disc.name = 'coffee';
  disc.add(lineArtMesh(art, new CylinderGeometry(0.031, 0.031, 0.004, 12)));
  disc.position.y = FULL_Y;

  const blobMaterial = new LineBasicMaterial({
    color: stroke,
    transparent: true,
    opacity: 1,
  });
  const outer = new LineLoop(blob(28, 0.12, 0.7), blobMaterial);
  const inner = new LineLoop(blob(20, 0.16, 2.1), blobMaterial);
  inner.scale.setScalar(0.55);
  for (const b of [outer, inner]) {
    b.raycast = () => {};
    b.position.y = 0.0012;
  }
  const puddle = new Group();
  puddle.add(outer, inner);
  puddle.visible = false;

  const dropGeometry = new BufferGeometry();
  dropGeometry.setAttribute(
    'position',
    new Float32BufferAttribute(new Float32Array(DROPS * 6), 3),
  );
  const dropLines = new LineSegments(dropGeometry, blobMaterial);
  dropLines.raycast = () => {};
  dropLines.frustumCulled = false;
  dropLines.visible = false;
  world.add(puddle, dropLines);

  const drops = Array.from({ length: DROPS }, () => ({
    p: new Vector3(),
    v: new Vector3(),
    life: 0,
  }));
  return {
    world,
    disc,
    amount: 1,
    puddle: { r: 0, at: new Vector3(), still: -1, fade: 0 },
    slosh: { x: 0, z: 0, vx: 0, vz: 0 },
    last: { p: new Vector3(), v: new Vector3(), ok: false },
    drops,
    dropLines,
    blobs: [outer, inner],
    blobMaterial,
  };
}

export interface MugNow {
  /** The mug's base in world space and the way its top points (unit). */
  base: Vector3;
  up: Vector3;
  /** Rim point nearest the ground when tipped, world space. */
  rim: Vector3;
  /** Height of whatever is under it (the desk top, 0). */
  ground: number;
}

const _a = new Vector3();

/** One frame of coffee: slosh, pour, drops, puddle, refill. `calm` skips the slosh and the drops. */
export function stepLiquid(
  L: Liquid,
  dt: number,
  mug: MugNow,
  calm: boolean,
): void {
  // slosh follows how the mug is being moved: a spring driven by its acceleration
  if (L.last.ok && dt > 0 && !calm) {
    _a.copy(mug.base).sub(L.last.p).divideScalar(dt);
    const ax = (_a.x - L.last.v.x) / dt;
    const az = (_a.z - L.last.v.z) / dt;
    L.last.v.copy(_a);
    const k = 90;
    L.slosh.vx += (-ax * 0.012 - L.slosh.x * k) * dt;
    L.slosh.vz += (-az * 0.012 - L.slosh.z * k) * dt;
    L.slosh.vx *= Math.exp(-5 * dt);
    L.slosh.vz *= Math.exp(-5 * dt);
    L.slosh.x = Math.max(-0.35, Math.min(0.35, L.slosh.x + L.slosh.vx * dt));
    L.slosh.z = Math.max(-0.35, Math.min(0.35, L.slosh.z + L.slosh.vz * dt));
  }
  L.last.p.copy(mug.base);
  L.last.ok = true;

  const tilt = Math.acos(Math.max(-1, Math.min(1, mug.up.y)));
  // the surface stays level in the world: counter the mug's tilt, plus the slosh
  L.disc.rotation.set(L.slosh.z, 0, -L.slosh.x);
  L.disc.position.y = EMPTY_Y + (FULL_Y - EMPTY_Y) * L.amount;
  L.disc.visible = L.amount > 0.03 && tilt < Math.PI * 0.6;

  // pour
  let pouring = false;
  if (tilt > SPILL_TILT && L.amount > 0) {
    pouring = true;
    const rate = 0.55 * Math.min(1, (tilt - SPILL_TILT) / 0.5 + 0.35);
    const used = Math.min(L.amount, rate * dt);
    L.amount -= used;
    if (!calm) {
      let want = Math.ceil(used * 70);
      for (const d of L.drops) {
        if (want <= 0) break;
        if (d.life > 0) continue;
        d.life = 1;
        d.p.copy(mug.rim);
        d.v.set(
          (Math.random() - 0.5) * 0.12 + mug.up.x * -0.25,
          0.02 + Math.random() * 0.05,
          (Math.random() - 0.5) * 0.12 + mug.up.z * -0.25,
        );
        want -= 1;
      }
    }
    growPuddle(L, mug.rim, used * 0.4);
  }

  stepDrops(L, dt, mug.ground, pouring);

  // a new cup after the puddle is gone, and only while the mug stands upright
  if (!pouring && tilt < 0.3 && L.puddle.r === 0 && L.amount < 1)
    L.amount = Math.min(1, L.amount + 0.04 * dt);
}

/** Drops fall and feed the puddle, which holds a while after it stops growing and then fades. */
export function stepDrops(
  L: Liquid,
  dt: number,
  ground: number,
  pouring: boolean,
): void {
  // drops fall to the ground and add to the puddle
  const pos = L.dropLines.geometry.getAttribute('position');
  let any = false;
  L.drops.forEach((d, i) => {
    if (d.life > 0) {
      any = true;
      d.v.y -= 3.2 * dt;
      d.p.addScaledVector(d.v, dt);
      if (d.p.y <= ground) {
        d.life = 0;
        growPuddle(L, d.p, 0.004);
      }
    }
    const on = d.life > 0;
    const o = i * 6;
    const arr = pos.array as Float32Array;
    arr[o] = d.p.x;
    arr[o + 1] = on ? d.p.y : -9;
    arr[o + 2] = d.p.z;
    arr[o + 3] = d.p.x - d.v.x * 0.03;
    arr[o + 4] = on ? d.p.y - d.v.y * 0.03 : -9;
    arr[o + 5] = d.p.z - d.v.z * 0.03;
  });
  pos.needsUpdate = true;
  L.dropLines.visible = any;

  // the puddle holds a while after it stops growing, then fades
  const P = L.puddle;
  if (P.r > 0) {
    if (P.still >= 0) {
      P.still += dt;
      if (P.still > 7) P.fade = Math.min(1, (P.still - 7) / 4);
      if (P.fade >= 1) {
        P.r = 0;
        P.still = -1;
        P.fade = 0;
      }
    }
  }
  if (!pouring && !any && P.r > 0 && P.still < 0) P.still = 0;
  const puddle = L.blobs[0].parent;
  if (puddle) {
    puddle.visible = P.r > 0.002;
    puddle.position.set(P.at.x, ground, P.at.z);
    puddle.scale.setScalar(Math.max(P.r, 0.0001));
    L.blobMaterial.opacity = 1 - ease(P.fade);
  }
}

function growPuddle(L: Liquid, at: Vector3, add: number): void {
  const P = L.puddle;
  if (P.r === 0) P.at.copy(at);
  else P.at.lerp(at, 0.04);
  P.r = Math.min(PUDDLE_MAX, P.r + add * 0.35);
  P.still = -1;
  P.fade = 0;
}

/** A fresh cup and a clean desk (the reset). */
export function refill(L: Liquid): void {
  L.amount = 1;
  // upright and still: no slosh left over from being knocked or thrown
  L.slosh.x = 0;
  L.slosh.z = 0;
  L.slosh.vx = 0;
  L.slosh.vz = 0;
  L.last.ok = false;
  L.disc.rotation.set(0, 0, 0);
  L.disc.visible = true;
  L.puddle.r = 0;
  L.puddle.still = -1;
  L.puddle.fade = 0;
  for (const d of L.drops) d.life = 0;
}
