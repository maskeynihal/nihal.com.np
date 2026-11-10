import { useEffect, useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  CoefficientCombineRule,
  Physics,
  useRapier,
  type RapierRigidBody,
} from '@react-three/rapier';
import {
  MathUtils,
  Matrix4,
  Plane,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
  type Mesh,
  type Object3D,
} from 'three';
import {
  DRAG_HALF,
  FOLLOW,
  MAX_TILT,
  TABLE_HALF,
  clamp,
} from '../../../lib/desk/drag';
import {
  ROOM_CLEARANCE,
  boundsFor,
  depthRange,
  floorWentDown,
  liftForFloor,
  planeOffset,
  foldDepthVelocity,
  project,
  reanchor,
  screenAccelDown,
  screenVelocity,
  startGravityScale,
  unproject,
  WALL_MARGIN,
  type Bounds,
} from '../../../lib/desk/fall';
import {
  cameraToWorld,
  vecToCamera,
  vecToWorld,
  worldToCamera,
} from '../../../lib/desk/camera';
import {
  GRAVITY,
  HANDOFF_RAMP_STEPS,
  SURFACE,
  feelFor,
} from '../../../lib/desk/materials';
import { playImpact } from '../../../lib/sound';
import { registry, type RegistryEntry } from '../registry';
import { table, tableFrame } from '../table';
import {
  fallBridge,
  physicsBridge,
  testControl,
  type AcceptResult,
  type BodyInfo,
  type FallApi,
  type Frame,
  type HandoffState,
} from '../physics-bridge';
import { screenRect } from './handoff';
import { readRoomPads, roomPadsAt } from './room';
import { coffee } from '../../../lib/desk/coffee';
import { readToken } from '../../../lib/desk/tokens';

/**
 * The fall world, inside the second canvas (`FallLayer.tsx`), a fixed full-viewport layer that
 * exists only while something has left the table.
 *
 * Its coordinates are the table camera's own frame: the camera is at the origin looking down -z,
 * gravity points straight down the screen, and the camera's principal point is anchored to where
 * the table canvas was when this world was built, so a body handed over at the same pose shows
 * the same picture. The floor is a horizontal plane that meets the bottom of the viewport at the
 * nearest depth a body can have; deeper floor appears higher up, so bodies that land farther back
 * rest higher on screen, as on a real floor. The side walls are the viewport's left and right
 * edges (slanted planes through the camera), there is a front and a back wall, and no ceiling.
 * The floor is the plane through the camera that meets the bottom of the viewport at every depth,
 * and bodies keep the depth they were handed over at, so each rests on the bottom edge of the
 * screen.
 *
 * Stepping is done here (fixed 1/60 s, interpolated for display) rather than by the library, so a
 * handoff is one synchronous call: no React render sits between taking a body and drawing it.
 */

const STEP = 1 / 60;
/** Steps over which a handed-over body's gravity grows from the matched value to the full one. */
const RAMP_STEPS = HANDOFF_RAMP_STEPS;
const WALL = 0.5;
/** Depth range (metres from the camera) used until the table camera is known. */
const Z_DEFAULT = { near: 2.0, far: 3.3 };
const MAX_SPEED = 6;

interface FallBody {
  entry: RegistryEntry;
  rb: RapierRigidBody;
  prevP: Vector3;
  prevQ: Quaternion;
  curP: Vector3;
  curQ: Quaternion;
  /** Until its first step the body shows the pose the table last drew. */
  fresh: boolean;
  gs0: number;
  age: number;
  speed: number;
  /** How much speed the last step lost to an impact (read and cleared by the coffee). */
  hit: number;
  /** Squash from the last hard landing, 1 down to 0: the picture flattens a little and springs back. */
  squash: number;
  /** Held still for the tether's reel: kinematic, and it pours nothing. */
  frozen: boolean;
}

interface Held {
  body: FallBody;
  depth: number;
  ox: number;
  oy: number;
  tx: number;
  ty: number;
  vx: number;
  vy: number;
  base: Quaternion;
}

/**
 * How far (m) an object's drawn mesh reaches beyond its collider (the ghost's skirt corners stick
 * out of its ball; a pac-man's rim of its). The room keeps the picture inside the sheet, so it
 * is moved in by the largest of these. Mesh vertices only (not the hull or the line quads),
 * measured in the object's own frame, whatever the object's pose is now.
 */
function overhangOf(entry: RegistryEntry): number {
  const root = entry.lift;
  root.updateWorldMatrix(true, true);
  const inv = new Matrix4().copy(entry.obj.matrixWorld).invert();
  const m = new Matrix4();
  const v = new Vector3();
  const { kind, args, offset } = entry.def.collider;
  const half =
    kind === 'cuboid' ? [args[0] ?? 0, args[1] ?? 0, args[2] ?? 0] : [0, 0, 0];
  const radius =
    kind === 'ball' ? (args[0] ?? 0) : (args[0] ?? 0) + (args[1] ?? 0);
  let worst = 0;
  root.traverse((node) => {
    const mesh = node as Mesh;
    if (
      !mesh.isMesh ||
      (node as { isLineSegments2?: boolean }).isLineSegments2 ||
      node.name.endsWith('-hull')
    )
      return;
    const pos = mesh.geometry.getAttribute('position');
    m.multiplyMatrices(inv, mesh.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(m);
      const dx = v.x - offset[0];
      const dy = v.y - offset[1];
      const dz = v.z - offset[2];
      const out =
        kind === 'cuboid'
          ? Math.hypot(
              Math.max(0, Math.abs(dx) - half[0]!),
              Math.max(0, Math.abs(dy) - half[1]!),
              Math.max(0, Math.abs(dz) - half[2]!),
            )
          : Math.max(0, Math.hypot(dx, dy, dz) - radius);
      if (out > worst) worst = out;
    }
  });
  return worst;
}

const _v = new Vector3();
const _fxUp = new Vector3();
const _fxM = new Vector3();
const _fxQ = new Quaternion();
const _q = new Quaternion();
const _tilt = new Quaternion();
const _cur = new Quaternion();

function FallWorld({
  anchor,
  onEmpty,
}: {
  anchor: Frame;
  onEmpty: () => void;
}) {
  const { rapier, world } = useRapier();
  const { scene, camera, size, invalidate, gl } = useThree();
  const view = useRef({ camera, width: size.width, height: size.height });
  useLayoutEffect(() => {
    view.current = { camera, width: size.width, height: size.height };
  });
  const bodies = useRef(new Map<string, FallBody>());
  const held = useRef<Held | null>(null);
  const bounds = useRef<Bounds | null>(null);
  // Depth range of the room, from the table camera (see `depthRange`).
  const zr = useRef(Z_DEFAULT);
  const room = useRef<{ body: RapierRigidBody } | null>(null);
  const clock = useRef({ acc: 0, idle: true, hold: testControl.hold });
  const raycaster = useMemo(() => new Raycaster(), []);
  const emptyTimer = useRef(0);

  // The static room, rebuilt when the viewport changes size.
  useEffect(() => {
    const vw = size.width;
    const vh = size.height;
    // The room is inside the sheet: its floor is the border's inner edge (plus the index strip below
    // 1024 px) and its walls the border's side edges (the right one also clear of the reset button),
    // each moved in by a clearance plus the most any object's mesh reaches beyond its collider, so a
    // body at rest is wholly inside the border, not touching it.
    const pads = readRoomPads(vw);
    // Bodies keep the depth they were handed over at, so the room must span every depth the table
    // can send one from: the rim and the whole area a carried object can reach, rim to a height
    // above the desk.
    const tcam = table.camera;
    if (tcam) {
      const depths: number[] = [];
      const c = new Vector3();
      for (const x of [-DRAG_HALF.x, DRAG_HALF.x])
        for (const z of [DRAG_HALF.zMin, DRAG_HALF.zMax])
          for (const y of [-0.5, 0.6])
            depths.push(
              -c.set(x, y, z).applyMatrix4(tcam.matrixWorldInverse).z,
            );
      zr.current = depthRange(depths);
    }
    const Z_NEAR = zr.current.near;
    const Z_FAR = zr.current.far;
    let overhang = 0;
    for (const e of registry.all())
      overhang = Math.max(overhang, overhangOf(e));
    const b = boundsFor(
      anchor,
      vw,
      vh,
      Z_NEAR,
      Z_FAR,
      pads.bottom,
      pads.left,
      pads.right,
      ROOM_CLEARANCE + overhang,
    );
    const prev = bounds.current;
    bounds.current = b;
    if (prev) {
      // The viewport changed height (a phone's URL bar): keep resting bodies on the new floor.
      const lower = floorWentDown(prev, b);
      for (const fb of bodies.current.values()) {
        // The floor went down: a sleeping body on the old one must fall to the new one.
        if (lower) fb.rb.wakeUp();
        const t = fb.rb.translation();
        const dy = liftForFloor(prev, b, t.y, -t.z);
        if (dy <= 0) continue;
        fb.rb.setTranslation({ x: t.x, y: t.y + dy, z: t.z }, true);
        fb.curP.y += dy;
        fb.prevP.y += dy;
      }
      if (lower) {
        clock.current.idle = true;
        invalidate();
      }
    }
    const body = world.createRigidBody(rapier.RigidBodyDesc.fixed());
    room.current = { body };
    const make = (
      hx: number,
      hy: number,
      hz: number,
      p: Vector3,
      q = new Quaternion(),
    ) =>
      world.createCollider(
        rapier.ColliderDesc.cuboid(hx, hy, hz)
          .setTranslation(p.x, p.y, p.z)
          .setRotation({ x: q.x, y: q.y, z: q.z, w: q.w })
          .setFriction(SURFACE.friction)
          .setRestitution(SURFACE.restitution)
          .setFrictionCombineRule(rapier.CoefficientCombineRule.Multiply)
          .setRestitutionCombineRule(rapier.CoefficientCombineRule.Max),
        body,
      );
    const mid = -(Z_NEAR + Z_FAR) / 2;
    // Floor: the plane y = slope * depth, so it meets the screen bottom at every depth. Front and back walls.
    const fn = new Vector3(0, 1, b.floorSlope).normalize();
    const fq = new Quaternion().setFromUnitVectors(new Vector3(0, 1, 0), fn);
    make(
      50,
      WALL,
      50,
      new Vector3(0, b.floorSlope * -mid, mid).addScaledVector(
        fn,
        b.reach - WALL,
      ),
      fq,
    );
    make(50, 50, WALL, new Vector3(0, 0, -Z_NEAR + WALL));
    make(50, 50, WALL, new Vector3(0, 0, -Z_FAR - WALL));
    // The viewport's side edges: planes through the camera, normals pointing inward.
    const left = new Vector3(1, 0, b.left).normalize();
    const right = new Vector3(-1, 0, -b.right).normalize();
    for (const n of [left, right]) {
      const q = new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), n);
      make(WALL, 50, 50, n.clone().multiplyScalar(b.reach - WALL), q);
    }
    return () => {
      // On unmount @react-three/rapier frees the world and resets its proxy, and this cleanup can run
      // after that: the proxy then makes a new, empty world and removing a body it never had traps
      // in wasm ("unreachable"). Only remove a body the current world still holds.
      if (world.getRigidBody(body.handle)) world.removeRigidBody(body);
      room.current = null;
    };
  }, [rapier, world, anchor, size.width, size.height]);

  const wake = () => {
    clock.current.idle = true;
    invalidate();
  };

  const toScreen = (p: Vector3) => project(p, anchor);

  // ---- the coffee, drawn on this layer's own canvas where the mug is --------------------------
  // Line-art drops leave the mug's mouth as it tips, a splash on the first hard landing, and a
  // puddle spreads along the floor and later fades. What is poured comes out of `coffee`.
  const fx = useRef({
    canvas: null as HTMLCanvasElement | null,
    drops: [] as { x: number; y: number; vx: number; vy: number }[],
    puddle: { x: 0, r: 0, still: 0, fade: 0 },
    last: { x: 0, y: 0, ok: false },
    color: '#fff',
  });
  useEffect(() => {
    const host = gl.domElement.parentElement;
    if (!host) return;
    const c = document.createElement('canvas');
    c.setAttribute('aria-hidden', 'true');
    c.style.cssText =
      'position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
    host.appendChild(c);
    const state = fx.current;
    state.canvas = c;
    return () => {
      c.remove();
      state.canvas = null;
    };
  }, [gl]);

  /** One frame of coffee; true while something is still drawn (so the layer keeps rendering). */
  const stepFx = (dt: number): boolean => {
    const F = fx.current;
    const c = F.canvas;
    if (!c) return false;
    const w = view.current.width;
    const h = view.current.height;
    const floorY = h - roomPadsAt(window.innerWidth).bottom;
    const mug = bodies.current.get('mug');
    const P = F.puddle;
    if (mug) {
      const obj = mug.entry.obj;
      obj.updateWorldMatrix(true, false);
      const up = _fxUp
        .set(0, 1, 0)
        .applyQuaternion(obj.getWorldQuaternion(_fxQ));
      const tilt = Math.acos(clamp(up.y, -1, 1));
      const mouth = toScreen(obj.localToWorld(_fxM.set(0, 0.085, 0)));
      const vx = F.last.ok && dt > 0 ? (mouth.x - F.last.x) / dt : 0;
      const vy = F.last.ok && dt > 0 ? (mouth.y - F.last.y) / dt : 0;
      F.last = { x: mouth.x, y: mouth.y, ok: true };
      if (!mug.frozen && coffee.amount > 0 && tilt > (60 * Math.PI) / 180) {
        const used = Math.min(coffee.amount, 0.45 * dt);
        coffee.amount -= used;
        for (let i = 0; i < Math.ceil(used * 160); i++)
          F.drops.push({
            x: mouth.x,
            y: mouth.y,
            vx: vx * 0.6 + (Math.random() - 0.5) * 60 - up.x * 40,
            vy: vy * 0.6 + 20 + Math.random() * 40,
          });
      }
      // a hard landing with coffee in it: a splash
      if (!mug.frozen && mug.hit > 1.2 && coffee.amount > 0 && tilt > 0.7) {
        for (let i = 0; i < 14; i++)
          F.drops.push({
            x: mouth.x,
            y: mouth.y,
            vx: (Math.random() - 0.5) * 420,
            vy: -150 - Math.random() * 330,
          });
        coffee.amount = Math.max(0, coffee.amount - 0.2);
      }
      mug.hit = 0;
    }
    if (F.drops.length === 0 && P.r === 0) {
      if (c.width !== 0) c.width = 0;
      return false;
    }
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    const ctx = c.getContext('2d');
    if (!ctx) return false;
    if (!F.color || F.drops.length === 0) F.color = readToken('--stroke');
    ctx.clearRect(0, 0, w, h);
    let landed = false;
    F.drops = F.drops.filter((d) => {
      d.vy += 2600 * dt;
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      if (d.y >= floorY) {
        landed = true;
        if (P.r === 0) {
          P.x = d.x;
          P.r = 3;
        } else P.x += (d.x - P.x) * 0.05;
        P.r = Math.min(64, P.r + 0.9);
        P.still = 0;
        P.fade = 0;
        return false;
      }
      return true;
    });
    if (!landed && F.drops.length === 0 && P.r > 0) {
      P.still += dt;
      if (P.still > 6) P.fade = Math.min(1, (P.still - 6) / 3);
      if (P.fade >= 1) P.r = 0;
    }
    ctx.strokeStyle = F.color;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (const d of F.drops) {
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x - d.vx * 0.012, d.y - d.vy * 0.012);
    }
    ctx.stroke();
    if (P.r > 0) {
      ctx.globalAlpha = 1 - P.fade * P.fade;
      for (const k of [1, 0.55]) {
        ctx.beginPath();
        ctx.ellipse(P.x, floorY - 2, P.r * k, P.r * k * 0.2, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    return true;
  };

  const scheduleEmpty = () => {
    window.clearTimeout(emptyTimer.current);
    if (bodies.current.size > 0) return;
    emptyTimer.current = window.setTimeout(() => {
      if (bodies.current.size === 0) onEmpty();
    }, 250);
  };

  const remove = (id: string): FallBody | undefined => {
    const b = bodies.current.get(id);
    if (!b) return;
    if (held.current?.body === b) held.current = null;
    // Not when the world is already gone (an unmount resets it first; see the room's cleanup).
    if (world.getRigidBody(b.rb.handle)) world.removeRigidBody(b.rb);
    bodies.current.delete(id);
    scene.remove(b.entry.obj);
    return b;
  };

  /** Moves a camera-frame state inside the floor, side and depth bounds (and stops it leaving). */
  const keepInside = (p: Vector3, v: Vector3, shown: Vector3): void => {
    const bd = bounds.current;
    if (!bd) return;
    const depth = clamp(-p.z, bd.zNear + 0.15, bd.zFar - 0.15);
    const xMin = bd.left * depth + planeOffset(bd.left, bd.reach) + WALL_MARGIN;
    const xMax =
      bd.right * depth - planeOffset(bd.right, bd.reach) - WALL_MARGIN;
    if (p.x < xMin) v.x = Math.max(v.x, 0);
    if (p.x > xMax) v.x = Math.min(v.x, 0);
    if (-p.z < bd.zNear + 0.15) v.z = Math.min(v.z, 0);
    if (-p.z > bd.zFar - 0.15) v.z = Math.max(v.z, 0);
    const y = Math.max(
      p.y,
      bd.floorSlope * depth + planeOffset(bd.floorSlope, bd.reach) + 0.12,
    );
    const moved = p.x < xMin || p.x > xMax || p.y < y || depth !== -p.z;
    p.set(clamp(p.x, xMin, xMax), y, -depth);
    if (moved) shown.copy(p);
  };

  /** Sends a body back to the table world. `target` is where the pointer is when it was dropped. */
  const returnToTable = (b: FallBody, tx: number, ty: number): void => {
    const frame = tableFrame();
    const cam = table.camera;
    const api = physicsBridge.api();
    if (!frame || !cam || !api) return;
    const pc = b.curP.clone();
    const lv = b.rb.linvel();
    const vc = new Vector3(lv.x, lv.y, lv.z);
    const av = b.rb.angvel();
    const wc = new Vector3(av.x, av.y, av.z);
    // Back to the principal point the table canvas has now.
    reanchor(pc, vc, anchor, frame);
    const pose = cameraToWorld(cam, pc, b.curQ);
    // Drop it from a little above the table, along the pointer's ray so the picture stays put.
    const ray = new Raycaster();
    ray.setFromCamera(
      new Vector2(
        ((tx - frame.left) / frame.w) * 2 - 1,
        -((ty - frame.top) / frame.h) * 2 + 1,
      ),
      cam,
    );
    if (pose.p.y < 0.18 && ray.ray.direction.y < -0.05) {
      const t = (0.18 - ray.ray.origin.y) / ray.ray.direction.y;
      pose.p.copy(ray.ray.origin).addScaledVector(ray.ray.direction, t);
    }
    const vw = vecToWorld(cam, vc);
    vw.y = Math.min(vw.y, 0);
    const ww = vecToWorld(cam, wc);
    remove(b.entry.id);
    api.receive({
      id: b.entry.id,
      p: [pose.p.x, pose.p.y, pose.p.z],
      q: [pose.q.x, pose.q.y, pose.q.z, pose.q.w],
      v: [vw.x, vw.y, vw.z],
      w: [ww.x, ww.y, ww.z],
    });
    scheduleEmpty();
  };

  /** True when the viewport point is over the table's top (the slab's footprint). */
  const overTable = (cx: number, cy: number): boolean => {
    const frame = tableFrame();
    const cam = table.camera;
    if (!frame || !cam) return false;
    const r = new Raycaster();
    r.setFromCamera(
      new Vector2(
        ((cx - frame.left) / frame.w) * 2 - 1,
        -((cy - frame.top) / frame.h) * 2 + 1,
      ),
      cam,
    );
    const hit = r.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), 0), _v);
    return (
      !!hit && Math.abs(hit.x) < TABLE_HALF.x && Math.abs(hit.z) < TABLE_HALF.z
    );
  };

  const sendHome = (b: FallBody): void => {
    const api = physicsBridge.api();
    remove(b.entry.id);
    const d = b.entry.def;
    if (api)
      api.receive({
        id: b.entry.id,
        p: d.p,
        q: d.q,
        v: [0, 0, 0],
        w: [0, 0, 0],
      });
    scheduleEmpty();
  };

  const stepOnce = () => {
    const h = held.current;
    for (const b of bodies.current.values()) {
      b.prevP.copy(b.curP);
      b.prevQ.copy(b.curQ);
    }
    if (h) {
      const b = h.body;
      const t = b.rb.translation();
      const nx = t.x + (h.tx - t.x) * FOLLOW;
      const ny = t.y + (h.ty - t.y) * FOLLOW;
      h.vx += ((nx - t.x) / STEP - h.vx) * 0.3;
      h.vy += ((ny - t.y) / STEP - h.vy) * 0.3;
      // Lean against the direction of travel, as on the table.
      const roll = clamp(-h.vx * 0.12, -MAX_TILT, MAX_TILT);
      const pitch = clamp(h.vy * 0.12, -MAX_TILT, MAX_TILT);
      _tilt.setFromAxisAngle(_v.set(0, 0, 1), roll);
      _q.setFromAxisAngle(_v.set(1, 0, 0), pitch);
      _tilt.premultiply(_q);
      _q.copy(h.base).premultiply(_tilt);
      const r = b.rb.rotation();
      _cur.set(r.x, r.y, r.z, r.w).slerp(_q, 0.25);
      b.rb.setNextKinematicTranslation({ x: nx, y: ny, z: t.z });
      b.rb.setNextKinematicRotation({
        x: _cur.x,
        y: _cur.y,
        z: _cur.z,
        w: _cur.w,
      });
    }
    for (const b of bodies.current.values()) {
      if (b.age < RAMP_STEPS) {
        const k = MathUtils.smoothstep(b.age / RAMP_STEPS, 0, 1);
        b.rb.setGravityScale(b.gs0 + (1 - b.gs0) * k, false);
        b.age += 1;
      }
    }
    world.step();
    const lost: FallBody[] = [];
    for (const b of bodies.current.values()) {
      const t = b.rb.translation();
      const r = b.rb.rotation();
      b.curP.set(t.x, t.y, t.z);
      b.curQ.set(r.x, r.y, r.z, r.w);
      b.fresh = false;
      const lv = b.rb.linvel();
      const speed = Math.hypot(lv.x, lv.y, lv.z);
      if (!Number.isFinite(t.x + t.y + t.z + speed) || b.curP.length() > 40)
        lost.push(b);
      if (b.speed - speed > 1.2 && held.current?.body !== b) {
        playImpact(b.speed);
        b.squash = Math.min(1, (b.speed - speed) / 3);
        b.hit = Math.max(b.hit, b.speed - speed);
      }
      b.squash *= 0.9;
      b.speed = speed;
    }
    // Safety net: a body that escaped the room goes back to its home pose on the table.
    for (const b of lost) sendHome(b);
  };

  const show = (alpha: number) => {
    for (const b of bodies.current.values()) {
      const obj = b.entry.obj;
      if (b.fresh) {
        obj.position.copy(b.prevP);
        obj.quaternion.copy(b.prevQ);
      } else {
        obj.position.lerpVectors(b.prevP, b.curP, alpha);
        obj.quaternion.slerpQuaternions(b.prevQ, b.curQ, alpha);
      }
      // a landing squashes it a little, from the contact point, and it springs back
      const q = b.squash;
      b.entry.lift.scale.set(1 + 0.12 * q, 1 - 0.2 * q, 1 + 0.12 * q);
    }
  };

  useFrame((_, dt) => {
    const c = clock.current;
    if (bodies.current.size === 0) return;
    if (!c.hold) {
      // The first frame after a wake-up steps once, not for the whole idle time.
      c.acc += c.idle ? STEP : Math.min(dt, 0.1);
      c.idle = false;
      while (c.acc >= STEP) {
        stepOnce();
        c.acc -= STEP;
      }
      show(c.acc / STEP);
    } else show(1);
    const fxBusy = stepFx(Math.min(dt, 0.05));
    let active = !!held.current || fxBusy;
    for (const b of bodies.current.values())
      if (!b.rb.isSleeping() || b.age < RAMP_STEPS) active = true;
    if (active && !c.hold) invalidate();
    else c.idle = true;
  });

  useEffect(() => {
    const aim = (cx: number, cy: number) => {
      raycaster.setFromCamera(
        new Vector2(
          (cx / view.current.width) * 2 - 1,
          -(cy / view.current.height) * 2 + 1,
        ),
        view.current.camera,
      );
    };
    const api: FallApi = {
      accept(s: HandoffState, frame: Frame): AcceptResult | null {
        const entry = registry.get(s.id);
        const cam = table.camera;
        if (!entry || !cam || bodies.current.has(s.id)) return null;
        const def = entry.def;
        const feel = feelFor(def.model);
        const pose = worldToCamera(
          cam,
          new Vector3(...s.p),
          new Quaternion(...s.q),
        );
        const vc = vecToCamera(cam, new Vector3(...s.v));
        const wc = vecToCamera(cam, new Vector3(...s.w));
        const shown = worldToCamera(
          cam,
          new Vector3(...(s.shown?.p ?? s.p)),
          new Quaternion(...(s.shown?.q ?? s.q)),
        );
        const gCam = new Vector3(...(s.gCam ?? [0, -GRAVITY, 0]));
        const aBefore = screenAccelDown(pose.p, vc, gCam, frame.f);
        // Same picture under a different principal point (the page scrolled since the mount).
        reanchor(pose.p, vc, frame, anchor);
        reanchor(shown.p, vc.clone(), frame, anchor);
        // A body that arrives outside the viewport (the canvas was slow to come up) is put just
        // inside it, moving inward, so it cannot start inside a wall.
        keepInside(pose.p, vc, shown.p);
        // The body keeps one depth (the floor slopes with depth), so its depth velocity goes into
        // the sideways and vertical ones: the picture moves exactly as fast as it did.
        foldDepthVelocity(pose.p, vc);
        const g = startGravityScale(pose.p, vc, gCam, frame.f);
        const desc = rapier.RigidBodyDesc.dynamic()
          .setTranslation(pose.p.x, pose.p.y, pose.p.z)
          .setRotation(pose.q)
          .setLinvel(vc.x, vc.y, vc.z)
          .setAngvel({ x: wc.x, y: wc.y, z: wc.z })
          .setLinearDamping(feel.linearDamping)
          .setAngularDamping(feel.angularDamping)
          .setGravityScale(g.scale)
          // Fixed depth: the floor slopes with depth, so a body must not slide along it.
          .enabledTranslations(true, true, false)
          .setCcdEnabled(true);
        const rb = world.createRigidBody(desc);
        const c = def.collider;
        const a = c.args;
        const cd =
          c.kind === 'ball'
            ? rapier.ColliderDesc.ball(a[0] ?? 0.05)
            : c.kind === 'capsule'
              ? rapier.ColliderDesc.capsule(a[0] ?? 0.05, a[1] ?? 0.03)
              : def.model === 'mug'
                ? // a mug is a cylinder: tipped over, it rolls on its side
                  rapier.ColliderDesc.cylinder(0.0425, 0.04)
                : rapier.ColliderDesc.cuboid(
                    a[0] ?? 0.05,
                    a[1] ?? 0.05,
                    a[2] ?? 0.05,
                  );
        world.createCollider(
          cd
            .setTranslation(
              def.model === 'mug' ? 0 : c.offset[0],
              c.offset[1],
              c.offset[2],
            )
            .setMass(def.mass)
            .setFriction(feel.friction)
            .setRestitution(feel.restitution)
            .setFrictionCombineRule(CoefficientCombineRule.Multiply)
            .setRestitutionCombineRule(CoefficientCombineRule.Max),
          rb,
        );
        const body: FallBody = {
          entry,
          rb,
          prevP: shown.p.clone(),
          prevQ: shown.q.clone(),
          curP: pose.p.clone(),
          curQ: pose.q.clone(),
          fresh: true,
          gs0: g.scale,
          age: 0,
          speed: Math.hypot(vc.x, vc.y, vc.z),
          squash: 0,
          hit: 0,
          frozen: false,
        };
        bodies.current.set(s.id, body);
        window.clearTimeout(emptyTimer.current);
        // The swap: out of the table scene, into this one, at the pose the table last drew.
        entry.obj.removeFromParent();
        entry.obj.position.copy(body.prevP);
        entry.obj.quaternion.copy(body.prevQ);
        scene.add(entry.obj);
        entry.obj.updateWorldMatrix(true, true);
        wake();
        table.invalidate();
        return {
          after: screenRect(entry.obj, toScreen),
          vAfter: screenVelocity(pose.p, vc, anchor.f),
          aBefore,
          aAfter: screenAccelDown(
            pose.p,
            vc,
            _v.set(0, -GRAVITY * g.scale, 0),
            anchor.f,
          ),
          gravityScale: g.scale,
        };
      },
      pick(cx, cy) {
        if (bodies.current.size === 0) return null;
        aim(cx, cy);
        scene.updateMatrixWorld();
        const roots: Object3D[] = [...bodies.current.values()].map(
          (b) => b.entry.obj,
        );
        const hit = raycaster.intersectObjects(roots, true)[0];
        if (!hit) return null;
        for (let o: Object3D | null = hit.object; o; o = o.parent) {
          const id: unknown = o.userData['deskId'];
          if (typeof id === 'string' && bodies.current.has(id)) return id;
        }
        return null;
      },
      grab(id, cx, cy) {
        const b = bodies.current.get(id);
        if (!b) return false;
        if (held.current) api.drop();
        const t = b.rb.translation();
        const depth = -t.z;
        const at = unproject(cx, cy, depth, anchor);
        b.rb.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
        const r = b.rb.rotation();
        held.current = {
          body: b,
          depth,
          ox: t.x - at.x,
          oy: t.y - at.y,
          tx: t.x,
          ty: t.y,
          vx: 0,
          vy: 0,
          base: new Quaternion(r.x, r.y, r.z, r.w),
        };
        b.age = RAMP_STEPS;
        wake();
        return true;
      },
      move(cx, cy) {
        const h = held.current;
        const bd = bounds.current;
        if (!h || !bd) return;
        const at = unproject(cx, cy, h.depth, anchor);
        // Stay inside the viewport and above the floor.
        const xMin = bd.left * h.depth + planeOffset(bd.left, bd.reach) + 0.06;
        const xMax =
          bd.right * h.depth - planeOffset(bd.right, bd.reach) - 0.06;
        h.tx = clamp(at.x + h.ox, xMin, xMax);
        h.ty = Math.max(
          at.y + h.oy,
          bd.floorSlope * h.depth + planeOffset(bd.floorSlope, bd.reach) + 0.06,
        );
        wake();
      },
      release(vx, vy, cx, cy) {
        const h = held.current;
        if (!h) return;
        held.current = null;
        const b = h.body;
        if (overTable(cx, cy)) {
          returnToTable(b, cx, cy);
          return;
        }
        const k = h.depth / anchor.f;
        const v = new Vector3(vx * k, -vy * k, 0);
        if (v.length() > MAX_SPEED) v.setLength(MAX_SPEED);
        b.rb.setBodyType(rapier.RigidBodyType.Dynamic, true);
        b.rb.setLinvel(v, true);
        b.rb.setAngvel({ x: 0, y: 0, z: -v.x * 0.5 }, true);
        b.rb.setGravityScale(1, true);
        wake();
      },
      drop() {
        const h = held.current;
        if (!h) return;
        held.current = null;
        h.body.rb.setBodyType(rapier.RigidBodyType.Dynamic, true);
        h.body.rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
        h.body.rb.setGravityScale(1, true);
        wake();
      },
      reset(keep) {
        for (const id of [...bodies.current.keys()]) {
          if (keep?.includes(id)) continue;
          const b = remove(id);
          if (!b) continue;
          const e = b.entry;
          registry.setFree(e.id, false);
          e.obj.position.set(...e.def.p);
          e.obj.quaternion.set(...e.def.q);
          // upright and unsquashed, wherever it had got to
          e.lift.scale.set(1, 1, 1);
          table.group?.add(e.obj);
        }
        // the coffee on this layer goes too: no drops in the air, no puddle
        fx.current.drops = [];
        fx.current.puddle = { x: 0, r: 0, still: 0, fade: 0 };
        fx.current.last = { x: 0, y: 0, ok: false };
        held.current = null;
        scheduleEmpty();
        table.invalidate();
      },
      capture(id) {
        const b = bodies.current.get(id);
        const frame = tableFrame();
        const cam = table.camera;
        if (!b || !frame || !cam) return null;
        // What is drawn (the interpolated pose), back through the table camera: the same picture.
        const o = b.entry.obj;
        const pc = o.position.clone();
        reanchor(pc, new Vector3(), anchor, frame);
        const w = cameraToWorld(cam, pc, o.quaternion);
        return {
          p: [w.p.x, w.p.y, w.p.z],
          q: [w.q.x, w.q.y, w.q.z, w.q.w],
        };
      },
      freeze(id) {
        const b = bodies.current.get(id);
        if (!b) return false;
        if (held.current?.body === b) held.current = null;
        b.rb.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
        b.rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
        b.rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
        b.frozen = true;
        b.age = RAMP_STEPS;
        // exactly the pose that is drawn, with no step still to interpolate
        b.prevP.copy(b.entry.obj.position);
        b.curP.copy(b.entry.obj.position);
        b.prevQ.copy(b.entry.obj.quaternion);
        b.curQ.copy(b.entry.obj.quaternion);
        b.rb.setTranslation(b.curP, true);
        b.rb.setRotation(b.curQ, true);
        b.fresh = false;
        wake();
        return true;
      },
      place(id, p, q) {
        const b = bodies.current.get(id);
        const frame = tableFrame();
        const cam = table.camera;
        if (!b || !frame || !cam) return;
        const pose = worldToCamera(
          cam,
          new Vector3(...p),
          new Quaternion(...q),
        );
        reanchor(pose.p, new Vector3(), frame, anchor);
        b.rb.setTranslation(pose.p, true);
        b.rb.setRotation(pose.q, true);
        b.prevP.copy(pose.p);
        b.curP.copy(pose.p);
        b.prevQ.copy(pose.q);
        b.curQ.copy(pose.q);
        b.fresh = false;
        wake();
      },
      home(id) {
        const b = bodies.current.get(id);
        if (!b) return;
        b.entry.lift.scale.set(1, 1, 1);
        sendHome(b);
      },
      jolt(dy) {
        const dv = clamp(dy * 0.006, -0.6, 0.6);
        for (const b of bodies.current.values()) {
          if (held.current?.body === b || b.rb.isKinematic()) continue;
          if (Math.abs(b.rb.linvel().y) > 1.5) continue;
          b.rb.applyImpulse({ x: 0, y: dv * b.rb.mass(), z: 0 }, true);
          b.rb.applyTorqueImpulse(
            { x: 0, y: 0, z: (Math.random() - 0.5) * b.rb.mass() * 0.01 },
            true,
          );
        }
        wake();
      },
      grabbed: () => held.current?.body.entry.id ?? null,
      bodies(): BodyInfo[] {
        return [...bodies.current.values()].map((b) => {
          const t = b.rb.translation();
          const at = toScreen(_v.set(t.x, t.y, t.z));
          return {
            id: b.entry.id,
            asleep: b.rb.isSleeping(),
            type: b.rb.isDynamic() ? 'dynamic' : 'kinematic',
            p: [t.x, t.y, t.z],
            screen: [at.x, at.y],
            rect: screenRect(b.entry.obj, toScreen),
          };
        });
      },
      count: () => bodies.current.size,
      hold(on) {
        clock.current.hold = on;
        wake();
      },
      step(n) {
        for (let i = 0; i < n; i++) stepOnce();
        show(1);
        invalidate();
      },
    };
    fallBridge.provide(api);
    return () => {
      window.clearTimeout(emptyTimer.current);
      fallBridge.provide(null);
      // Nothing may be left in this scene when its canvas is disposed.
      api.reset();
    };
    // Everything the api closes over is a ref or stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rapier, world, anchor]);

  return null;
}

export default function FallPhysics({
  anchor,
  onEmpty,
}: {
  anchor: Frame;
  onEmpty: () => void;
}) {
  // The library's own stepping is off: this world steps itself (see FallWorld).
  return (
    <Physics paused gravity={[0, -GRAVITY, 0]} timeStep={STEP}>
      <FallWorld anchor={anchor} onEmpty={onEmpty} />
    </Physics>
  );
}
