import {
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  LineLoop,
  Quaternion,
  Vector3,
  type Color,
} from 'three';
import type { RegistryEntry } from './registry';
import { fallBridge } from './physics-bridge';

/**
 * The reset, as a tether: a thin line shoots from a point (the lamp) to each object that is out of
 * place, latches with a small ring, and reels it back along an arc to where it belongs, with a
 * little swing as it settles; then the line fades. One object after the other. Line art only.
 *
 * The objects are put home first (the physics layer does that at once); what is drawn here is each
 * one's `fx` group carrying it from the exact pose it had when the reset was pressed (position and
 * rotation) to where it belongs, so nothing in the physics changes and nothing jumps: until its line
 * latches an object is drawn exactly where it was. An object in the fall layer stays there instead
 * (held still by the fall world) and is moved along the same path in table-world terms, through the
 * same camera, so it travels up from the bottom of the screen; it goes home when its reel ends.
 */
export interface TetherItem {
  entry: RegistryEntry;
  /** Seconds after the start before its line goes (the sitter has to turn to it first). */
  delay?: number;
  /** Where it was relative to home (world metres). */
  from: Vector3;
  /** Its world rotation when the reset was pressed (default: its rest rotation). */
  q?: Quaternion;
  /** It is in the fall layer (frozen there), not drawn through `fx`. */
  fall?: boolean;
}

interface Strand {
  item: TetherItem;
  line: Line;
  ring: LineLoop;
  delay: number;
  /** `from` and `q` in the frame of the object's home (what `fx` works in). */
  from0: Vector3;
  q0: Quaternion;
  homeQ: Quaternion;
  homed: boolean;
}

export interface Tether {
  group: Group;
  strands: Strand[];
  t: number;
  anchor: Vector3;
  material: LineBasicMaterial;
  ringMaterial: LineBasicMaterial;
}

const POINTS = 16;
const SHOOT = 0.3;
const REEL = 0.8;
const FADE = 0.3;
const STAGGER = 0.14;
const ease = (u: number) => u * u * (3 - 2 * u);

const ring = (): BufferGeometry => {
  const g = new BufferGeometry();
  const pts: number[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const r = i % 2 ? 0.6 : 1;
    pts.push(Math.cos(a) * r, 0, Math.sin(a) * r);
  }
  g.setAttribute('position', new Float32BufferAttribute(pts, 3));
  return g;
};

/** A new tether from `anchor` (the caller moves it as the hand moves) to every item. */
export function createTether(
  items: TetherItem[],
  anchor: Vector3,
  stroke: Color,
  lead = 0,
): Tether {
  const group = new Group();
  group.name = 'tether';
  const material = new LineBasicMaterial({
    color: stroke,
    transparent: true,
    opacity: 1,
  });
  const ringMaterial = new LineBasicMaterial({
    color: stroke,
    transparent: true,
    opacity: 1,
  });
  const strands = items.map((item, i) => {
    const g = new BufferGeometry();
    g.setAttribute(
      'position',
      new Float32BufferAttribute(new Float32Array(POINTS * 3), 3),
    );
    g.setDrawRange(0, 0);
    const line = new Line(g, material);
    line.frustumCulled = false;
    line.raycast = () => {};
    const rg = new LineLoop(ring(), ringMaterial);
    rg.raycast = () => {};
    rg.visible = false;
    group.add(line, rg);
    const homeQ = new Quaternion(...item.entry.def.q);
    const inv = homeQ.clone().invert();
    return {
      item,
      line,
      ring: rg,
      delay: item.delay ?? i * STAGGER,
      from0: item.from.clone().applyQuaternion(inv),
      q0: item.q ? inv.clone().multiply(item.q) : new Quaternion(),
      homeQ,
      homed: false,
    };
  });
  // `lead` seconds pass before the first line goes (the sitter is raising an arm)
  return { group, strands, t: -lead, anchor, material, ringMaterial };
}

const _t = new Vector3();
const _p = new Vector3();
const _w = new Vector3();
const _q = new Quaternion();
const _swing = new Quaternion();
const _id = new Quaternion();
const _z = new Vector3(0, 0, 1);

/** Sets where an object is (home frame): through `fx`, or in the fall layer for a free one. */
function setPose(s: Strand, pos: Vector3, q: Quaternion): void {
  const { entry, fall } = s.item;
  if (fall) {
    _w.copy(pos).applyQuaternion(s.homeQ);
    const wp = _w.add(_p.set(...entry.def.p));
    _q.copy(s.homeQ).multiply(q);
    fallBridge
      .api()
      ?.place(entry.id, [wp.x, wp.y, wp.z], [_q.x, _q.y, _q.z, _q.w]);
    return;
  }
  entry.fx.position.copy(pos);
  entry.fx.quaternion.copy(q);
}

/** A free object that has been reeled in arrives home (once). */
function arrive(s: Strand): void {
  if (s.homed) return;
  s.homed = true;
  if (s.item.fall) fallBridge.api()?.home(s.item.entry.id);
  else {
    s.item.entry.fx.position.set(0, 0, 0);
    s.item.entry.fx.rotation.set(0, 0, 0);
  }
}

/** Advances the tether; true while there is still something to draw. */
export function stepTether(T: Tether, dt: number): boolean {
  T.t += dt;
  let live = false;
  for (const s of T.strands) {
    const t = T.t - s.delay;
    const { entry } = s.item;
    if (t < 0) {
      // not yet reeled: it still sits exactly where it was (a free one is frozen there already)
      if (!s.item.fall) {
        entry.fx.position.copy(s.from0);
        entry.fx.quaternion.copy(s.q0);
      }
      live = true;
      continue;
    }
    const reel = Math.min(Math.max((t - SHOOT) / REEL, 0), 1);
    const e = ease(reel);
    // the object: along an arc home, swinging a little as it comes in (all zero at the start)
    _t.set(
      s.from0.x * (1 - e) + 0.03 * Math.sin(reel * Math.PI * 3) * (1 - reel),
      s.from0.y * (1 - e) + 0.16 * Math.sin(reel * Math.PI),
      s.from0.z * (1 - e),
    );
    _swing.setFromAxisAngle(
      _z,
      0.35 * Math.sin(reel * Math.PI * 2.5) * (1 - reel),
    );
    const turn = _id.identity().slerpQuaternions(s.q0, _q.identity(), e);
    turn.multiply(_swing);
    if (!s.homed) setPose(s, _t, turn);
    // the line: from the anchor to the object, sagging, drawn out as it shoots
    _t.applyQuaternion(s.homeQ);
    _t.set(
      entry.def.p[0] + _t.x,
      entry.def.p[1] + _t.y + 0.03,
      entry.def.p[2] + _t.z,
    );
    const reach = ease(Math.min(t / SHOOT, 1));
    const sag = 0.12 * (1 - 0.7 * reel);
    const pos = s.line.geometry.getAttribute('position');
    const arr = pos.array as Float32Array;
    for (let i = 0; i < POINTS; i++) {
      const u = i / (POINTS - 1);
      _p.lerpVectors(T.anchor, _t, u);
      _p.y -= sag * Math.sin(u * Math.PI);
      arr[i * 3] = _p.x;
      arr[i * 3 + 1] = _p.y;
      arr[i * 3 + 2] = _p.z;
    }
    pos.needsUpdate = true;
    s.line.geometry.setDrawRange(0, Math.max(2, Math.round(reach * POINTS)));
    // the ring where it latches
    const latched = t >= SHOOT;
    s.ring.visible = latched && t < SHOOT + 0.35;
    if (s.ring.visible) {
      const k = (t - SHOOT) / 0.35;
      s.ring.position.copy(_t);
      s.ring.scale.setScalar(0.012 + 0.03 * k);
    }
    // the line fades once the object is home
    const done = t - (SHOOT + REEL);
    const fade = done > 0 ? Math.min(done / FADE, 1) : 0;
    s.line.visible = fade < 1;
    if (reel >= 1) arrive(s);
    if (fade < 1) live = true;
  }
  // one shared material: fade it with the last strand in flight
  const last = T.strands[T.strands.length - 1];
  if (last) {
    const done = T.t - last.delay - (SHOOT + REEL);
    T.material.opacity = done > 0 ? Math.max(0, 1 - done / FADE) : 1;
  }
  return live;
}

/** Puts every object back at rest at once (a tether cut short). */
export function endTether(T: Tether): void {
  for (const s of T.strands) arrive(s);
  T.group.removeFromParent();
  T.group.traverse((o) => {
    const g = (o as Line).geometry as BufferGeometry | undefined;
    g?.dispose();
  });
  T.material.dispose();
  T.ringMaterial.dispose();
}
