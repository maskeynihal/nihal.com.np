import {
  BoxGeometry,
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  Group,
  LineBasicMaterial,
  LineLoop,
  LineSegments,
  Mesh,
  PlaneGeometry,
  SphereGeometry,
  Vector3,
  type Material,
  type Object3D,
} from 'three';
import { lineArtMesh, type LineArt } from './line-art';

/**
 * What comes out of the drawer, other than the card and the duck (those are nodes of the desk model):
 * a sticky note that flies to the monitor, a floppy disk, a fortune cookie, and a burst of paper
 * bits. All built here from boxes and spheres in the page's line art (no model files, so the
 * models budget is untouched). Coordinates are world metres: the desk model sits at the origin, so
 * its root is a parent in world space.
 *
 * The motion is plain functions of the time since the drawer opened (`...Tf`), so it can be tested
 * and played backwards: closing the drawer takes what is out and returns it to the tray.
 */
export type V3 = [number, number, number];

/** A pose: position, Euler rotation (x, y, z) and scale. */
export interface Tf {
  p: V3;
  r: V3;
  s: V3;
}

/** Where the drawer's items start: the middle of the tray (z grows with the slide). */
export const TRAY_AT: V3 = [-0.5, -0.136, 0.43];
export const DUCK_LAND: V3 = [-0.2, 0, 0.38];
export const COOKIE_SPOT: V3 = [-0.2, 0.012, 0.38];
export const STICKY_SPOT: V3 = [0.43, 0.17, -0.098];
export const FLOPPY_HOVER: V3 = [-0.2, 0.2, 0.5];
export const FLOPPY_REST: V3 = [-0.14, 0.004, 0.36];
/** The seconds the floppy hovers before the developer takes it. */
export const FLOPPY_WAIT = 1.2;

const clamp = (v: number, a = 0, b = 1) => Math.min(Math.max(v, a), b);
const ease = (u: number) => u * u * (3 - 2 * u);
const mix = (a: V3, b: V3, t: number): V3 => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const tray = (slide: number): V3 => [
  TRAY_AT[0],
  TRAY_AT[1],
  TRAY_AT[2] + slide,
];

/** The card: rises out of the tray, unfolds, and stands leaning back, floating a little. */
export function cardTf(t: number, slide: number): Tf {
  // a dip first (anticipation), then up
  const dip = t < 0.22 ? -0.012 * Math.sin((t / 0.22) * Math.PI) : 0;
  const e = ease(clamp((t - 0.22) / 1.4));
  const bob = e >= 1 ? Math.sin(t * 2) * 0.004 : 0;
  return {
    p: [
      TRAY_AT[0],
      TRAY_AT[1] + 0.15 * e + bob + dip,
      TRAY_AT[2] + slide + 0.06 * e,
    ],
    r: [1.05 * e, 0, e >= 1 ? Math.sin(t * 1.3) * 0.03 : 0],
    s: [1, 1, 0.05 + 0.95 * e],
  };
}

/** A hop starts with a crouch (0.25 s), then flies for 0.9 s: when it lands. */
export const HOP_START = 0.25;
export const HOP_END = HOP_START + 0.9;

/** The duck: crouches, jumps out of the tray in an arc onto the desk, spinning once, then waddles. */
export function duckTf(t: number, slide: number): Tf {
  if (t < HOP_START) {
    const c = Math.sin((t / HOP_START) * Math.PI * 0.5);
    return {
      p: tray(slide),
      r: [0, 0, 0],
      s: [1 + 0.15 * c, 1 - 0.3 * c, 1 + 0.15 * c],
    };
  }
  const u = clamp((t - HOP_START) / 0.9);
  if (u < 1) {
    const p = mix(tray(slide), DUCK_LAND, u);
    p[1] += 0.32 * Math.sin(u * Math.PI);
    return {
      p,
      r: [-0.5 * Math.sin(u * Math.PI), Math.PI * 2 * ease(u), 0],
      s: [
        1 - 0.12 * Math.sin(u * Math.PI),
        1 + 0.2 * Math.sin(u * Math.PI),
        1 - 0.12 * Math.sin(u * Math.PI),
      ],
    };
  }
  const w = t - HOP_END;
  // it bounces twice more, lower each time, wobbling as it settles
  const bounce = 0.05 * Math.exp(-w * 4) * Math.abs(Math.sin(w * 9));
  const wob = Math.exp(-w * 2.5) * Math.sin(w * 14) * 0.2;
  const waddle = clamp((w - 1.2) / 0.6);
  return {
    p: [
      DUCK_LAND[0] + 0.012 * waddle * Math.sin(w * 2.4),
      DUCK_LAND[1] + bounce + 0.004 * waddle * Math.abs(Math.sin(w * 5)),
      DUCK_LAND[2],
    ],
    r: [
      0,
      0.25 * waddle * Math.sin(w * 2.4),
      wob + 0.16 * waddle * Math.sin(w * 5),
    ],
    s: [1, 1, 1],
  };
}

/** The sticky note: flies up and across, fluttering, and sticks to the bottom of the monitor. */
export function stickyTf(t: number, slide: number): Tf {
  const dip = t < 0.22 ? -0.012 * Math.sin((t / 0.22) * Math.PI) : 0;
  const u = clamp((t - 0.22) / 1.5);
  const e = ease(u);
  const p = mix(tray(slide), STICKY_SPOT, e);
  p[1] += 0.25 * Math.sin(u * Math.PI) + dip;
  const flutter =
    u < 1 ? (1 - u) * Math.sin(u * 16) * 0.7 : Math.sin(t * 3) * 0.03;
  return {
    p,
    r: [-0.9 * (1 - e), 0, flutter],
    s: [0.3 + 0.7 * e, 0.3 + 0.7 * e, 1],
  };
}

/** The floppy before the hand has it: slides out, spins and rises to a hover. */
export function floppyTf(t: number, slide: number): Tf {
  const dip = t < 0.22 ? -0.012 * Math.sin((t / 0.22) * Math.PI) : 0;
  const u = clamp((t - 0.22) / (FLOPPY_WAIT - 0.22));
  const e = ease(u);
  const p = mix(tray(slide), FLOPPY_HOVER, e);
  p[1] += dip;
  return {
    p,
    r: [0.5 * Math.sin(u * Math.PI), Math.PI * 4 * e, 0],
    s: [1, 1, 1],
  };
}

/** The cookie: crouches, hops out of the tray onto the desk, turning once. */
export function cookieTf(t: number, slide: number): Tf {
  if (t < HOP_START) {
    const c = Math.sin((t / HOP_START) * Math.PI * 0.5);
    return {
      p: tray(slide),
      r: [0, 0, 0],
      s: [1 + 0.1 * c, 1 - 0.25 * c, 1 + 0.1 * c],
    };
  }
  const u = clamp((t - HOP_START) / 0.9);
  const p = mix(tray(slide), COOKIE_SPOT, u);
  p[1] += 0.28 * Math.sin(u * Math.PI);
  let wob = 0;
  if (u >= 1) {
    // two more bounces, lower each time
    const w = t - HOP_END;
    p[1] += 0.045 * Math.exp(-w * 4.5) * Math.abs(Math.sin(w * 9.5));
    wob = Math.exp(-w * 3) * Math.sin(w * 13) * 0.12;
  }
  return { p, r: [0, Math.PI * 2 * ease(u), wob], s: [1, 1, 1] };
}

/** Lays a pose on an object. */
export function applyTf(o: Object3D, tf: Tf): void {
  o.position.set(...tf.p);
  o.rotation.set(...tf.r);
  o.scale.set(...tf.s);
}

/** Shows or hides an object so that it is neither drawn nor picked (a hidden object is still raycast). */
export function setShown(o: Object3D, on: boolean): void {
  if (o.userData['shown'] === on) return;
  o.userData['shown'] = on;
  o.visible = on;
  o.traverse((n) => n.layers.set(on ? 0 : 1));
}

export interface Bit {
  m: LineLoop;
  v: Vector3;
  spin: Vector3;
}

export interface Finds {
  group: Group;
  sticky: Group;
  floppy: Group;
  cookie: Group;
  cookieL: Object3D;
  cookieR: Object3D;
  slip: Group;
  confetti: Group;
  bits: Bit[];
  /** Cookie cracked, 0..1, and the tap that moves it. */
  crack: { value: number; target: number };
  /** Rubber duck squash, 1 to 0 after a tap or a landing. */
  squash: number;
  /** Seconds since the burst, or -1. */
  burst: number;
  /** Sparks over the tray when the drawer has opened. */
  glint: LineSegments;
  glintMaterial: LineBasicMaterial;
}

const BITS = 30;

/** Builds every procedural find (all hidden); `stickyMat` and `slipMat` carry the written faces. */
export function buildFinds(
  art: LineArt,
  stickyMat: Material,
  slipMat: Material,
  stroke: Color,
): Finds {
  const group = new Group();
  group.name = 'finds';

  const sticky = new Group();
  sticky.userData['find'] = 'note';
  sticky.add(lineArtMesh(art, new BoxGeometry(0.1, 0.1, 0.004)));
  const face = new Mesh(new PlaneGeometry(0.094, 0.094), stickyMat);
  face.position.z = 0.0022;
  sticky.add(face);

  const floppy = new Group();
  floppy.userData['find'] = 'floppy';
  floppy.add(lineArtMesh(art, new BoxGeometry(0.09, 0.004, 0.09)));
  const shutter = lineArtMesh(art, new BoxGeometry(0.036, 0.0045, 0.03));
  shutter.position.set(0, 0.0005, -0.03);
  floppy.add(shutter);
  const label = lineArtMesh(art, new BoxGeometry(0.06, 0.0043, 0.034));
  label.position.set(0, 0.0003, 0.012);
  floppy.add(label);

  const cookie = new Group();
  cookie.userData['find'] = 'cookie';
  const half = () => {
    const g = new Group();
    const inner = lineArtMesh(
      art,
      new SphereGeometry(0.034, 10, 6, 0, Math.PI),
    );
    inner.rotation.set(0, Math.PI / 2, 0);
    inner.scale.set(1, 0.55, 1.15);
    g.add(inner);
    return g;
  };
  const cookieL = half();
  const cookieR = half();
  cookieR.rotation.y = Math.PI;
  cookie.add(cookieL, cookieR);
  const slip = new Group();
  slip.add(lineArtMesh(art, new BoxGeometry(0.1, 0.002, 0.022)));
  const slipFace = new Mesh(new PlaneGeometry(0.094, 0.02), slipMat);
  slipFace.rotation.x = -Math.PI / 2;
  slipFace.position.y = 0.0011;
  slip.add(slipFace);
  slip.userData['find'] = 'cookie';
  cookie.add(slip);

  const confetti = new Group();
  const bitGeometry = new BufferGeometry();
  bitGeometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      [-0.008, -0.005, 0, 0.008, -0.005, 0, 0.008, 0.005, 0, -0.008, 0.005, 0],
      3,
    ),
  );
  const bitMaterial = new LineBasicMaterial({ color: stroke });
  const bits: Bit[] = [];
  for (let i = 0; i < BITS; i++) {
    const m = new LineLoop(bitGeometry, bitMaterial);
    m.raycast = () => {};
    confetti.add(m);
    bits.push({ m, v: new Vector3(), spin: new Vector3() });
  }

  // three small crosses that flash over the tray when it opens
  const spark = new BufferGeometry();
  const cross: number[] = [];
  for (const [x, y, z] of [
    [-0.06, 0.03, 0],
    [0.02, 0.06, 0.04],
    [0.07, 0.02, -0.03],
  ] as const)
    cross.push(
      x - 0.012,
      y,
      z,
      x + 0.012,
      y,
      z,
      x,
      y - 0.012,
      z,
      x,
      y + 0.012,
      z,
    );
  spark.setAttribute('position', new Float32BufferAttribute(cross, 3));
  const glintMaterial = new LineBasicMaterial({
    color: stroke,
    transparent: true,
    opacity: 0,
  });
  const glint = new LineSegments(spark, glintMaterial);
  glint.raycast = () => {};
  glint.frustumCulled = false;
  group.add(sticky, floppy, cookie, confetti, glint);
  for (const o of [sticky, floppy, cookie, confetti]) setShown(o, false);
  return {
    group,
    sticky,
    floppy,
    cookie,
    cookieL,
    cookieR,
    slip,
    confetti,
    bits,
    crack: { value: 0, target: 0 },
    squash: 0,
    burst: -1,
    glint,
    glintMaterial,
  };
}

/** Starts a burst of paper bits from `from` (world metres). */
export function startBurst(f: Finds, from: V3): void {
  f.burst = 0;
  for (const b of f.bits) {
    b.m.position.set(...from);
    b.v.set(
      (Math.random() - 0.5) * 0.9,
      0.5 + Math.random() * 0.7,
      (Math.random() - 0.2) * 0.8,
    );
    b.spin.set(
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 12,
      (Math.random() - 0.5) * 12,
    );
  }
  setShown(f.confetti, true);
}

/** Moves the paper bits on, and hides them when the burst is over. */
export function stepBurst(f: Finds, dt: number): void {
  if (f.burst < 0) return;
  f.burst += dt;
  for (const b of f.bits) {
    b.v.y -= 1.7 * dt;
    b.m.position.addScaledVector(b.v, dt);
    b.m.rotation.x += b.spin.x * dt;
    b.m.rotation.y += b.spin.y * dt;
    b.m.rotation.z += b.spin.z * dt;
  }
  if (f.burst > 2.6) {
    f.burst = -1;
    setShown(f.confetti, false);
  }
}

/** Opens the cookie as `crack` goes 0 to 1: the halves part and the slip slides out. */
export function poseCookie(f: Finds): void {
  const c = ease(f.crack.value);
  f.cookieL.position.set(-0.03 * c, 0, 0);
  f.cookieL.rotation.z = 0.7 * c;
  f.cookieR.position.set(0.03 * c, 0, 0);
  f.cookieR.rotation.z = -0.7 * c;
  f.slip.position.set(0, 0.012 + 0.012 * c, 0.02 + 0.08 * c);
  setShown(f.slip, f.crack.value > 0.02);
}

/** The sparks: they flash once as the drawer finishes sliding out (`t` seconds after it did). */
export function poseGlint(f: Finds, t: number, slide: number): void {
  const k = t < 0 || t > 0.7 ? 0 : Math.sin((t / 0.7) * Math.PI);
  f.glintMaterial.opacity = k;
  f.glint.visible = k > 0.01;
  f.glint.position.set(TRAY_AT[0], TRAY_AT[1] + 0.03, TRAY_AT[2] + slide);
  f.glint.scale.setScalar(0.6 + 0.8 * k);
}
