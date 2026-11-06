import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import {
  CoefficientCombineRule,
  Physics,
  useRapier,
  type RapierRigidBody,
} from '@react-three/rapier';
import {
  MathUtils,
  Plane,
  Quaternion,
  Raycaster,
  Vector2,
  Vector3,
  type Object3D,
} from 'three';
import { FOLLOW, MAX_TILT, TABLE_HALF, clamp } from '../../../lib/desk/drag';
import {
  boundsFor,
  project,
  reanchor,
  screenAccelDown,
  screenVelocity,
  startGravityScale,
  unproject,
  type Bounds,
} from '../../../lib/desk/fall';
import {
  cameraToWorld,
  vecToCamera,
  vecToWorld,
  worldToCamera,
} from '../../../lib/desk/camera';
import { GRAVITY, feelFor } from '../../../lib/desk/materials';
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
 *
 * Stepping is done here (fixed 1/60 s, interpolated for display) rather than by the library, so a
 * handoff is one synchronous call: no React render sits between taking a body and drawing it.
 */

const STEP = 1 / 60;
/** Steps over which a handed-over body's gravity grows from the matched value to the real one. */
const RAMP_STEPS = 14;
const WALL = 0.5;
/** Nearest and farthest depth a body may have, metres from the camera. */
const Z_NEAR = 2.0;
const Z_FAR = 3.3;
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

const _v = new Vector3();
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
  const { scene, camera, size, invalidate } = useThree();
  const view = useRef({ camera, width: size.width, height: size.height });
  view.current = { camera, width: size.width, height: size.height };
  const bodies = useRef(new Map<string, FallBody>());
  const held = useRef<Held | null>(null);
  const bounds = useRef<Bounds | null>(null);
  const room = useRef<{ body: RapierRigidBody } | null>(null);
  const clock = useRef({ acc: 0, idle: true, hold: testControl.hold });
  const raycaster = useMemo(() => new Raycaster(), []);
  const emptyTimer = useRef(0);

  // The static room, rebuilt when the viewport changes size.
  useEffect(() => {
    const vw = size.width;
    const vh = size.height;
    // Below 1024 px the sheet index is a strip along the bottom; from there only the border line.
    const b = boundsFor(anchor, vw, vh, Z_NEAR, Z_FAR, vw < 1024 ? 64 : 16);
    bounds.current = b;
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
          .setFriction(1)
          .setRestitution(0)
          .setFrictionCombineRule(rapier.CoefficientCombineRule.Multiply)
          .setRestitutionCombineRule(rapier.CoefficientCombineRule.Max),
        body,
      );
    const mid = -(Z_NEAR + Z_FAR) / 2;
    // Floor, front and back walls.
    make(50, WALL, 50, new Vector3(0, b.floorY - WALL, mid));
    make(50, 50, WALL, new Vector3(0, 0, -Z_NEAR + WALL));
    make(50, 50, WALL, new Vector3(0, 0, -Z_FAR - WALL));
    // The viewport's side edges: planes through the camera, normals pointing inward.
    const left = new Vector3(1, 0, b.left).normalize();
    const right = new Vector3(-1, 0, -b.right).normalize();
    for (const n of [left, right]) {
      const q = new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), n);
      make(WALL, 50, 50, n.clone().multiplyScalar(-WALL), q);
    }
    return () => {
      world.removeRigidBody(body);
      room.current = null;
    };
  }, [rapier, world, anchor, size.width, size.height]);

  const wake = () => {
    clock.current.idle = true;
    invalidate();
  };

  const toScreen = (p: Vector3) => project(p, anchor);

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
    world.removeRigidBody(b.rb);
    bodies.current.delete(id);
    scene.remove(b.entry.obj);
    return b;
  };

  /** Moves a camera-frame state inside the floor, side and depth bounds (and stops it leaving). */
  const keepInside = (p: Vector3, v: Vector3, shown: Vector3): void => {
    const bd = bounds.current;
    if (!bd) return;
    const depth = clamp(-p.z, bd.zNear + 0.15, bd.zFar - 0.15);
    const xMin = bd.left * depth + 0.1;
    const xMax = bd.right * depth - 0.1;
    if (p.x < xMin) v.x = Math.max(v.x, 0);
    if (p.x > xMax) v.x = Math.min(v.x, 0);
    if (-p.z < bd.zNear + 0.15) v.z = Math.min(v.z, 0);
    if (-p.z > bd.zFar - 0.15) v.z = Math.max(v.z, 0);
    const y = Math.max(p.y, bd.floorY + 0.12);
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
      if (b.speed - speed > 1.2 && held.current?.body !== b)
        playImpact(b.speed);
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
    let active = !!held.current;
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
        const g = startGravityScale(pose.p, vc, gCam, frame.f);
        const desc = rapier.RigidBodyDesc.dynamic()
          .setTranslation(pose.p.x, pose.p.y, pose.p.z)
          .setRotation(pose.q)
          .setLinvel(vc.x, vc.y, vc.z)
          .setAngvel({ x: wc.x, y: wc.y, z: wc.z })
          .setLinearDamping(feel.linearDamping)
          .setAngularDamping(feel.angularDamping)
          .setGravityScale(g.scale)
          .setCcdEnabled(true);
        const rb = world.createRigidBody(desc);
        const c = def.collider;
        const a = c.args;
        const cd =
          c.kind === 'ball'
            ? rapier.ColliderDesc.ball(a[0] ?? 0.05)
            : c.kind === 'capsule'
              ? rapier.ColliderDesc.capsule(a[0] ?? 0.05, a[1] ?? 0.03)
              : rapier.ColliderDesc.cuboid(
                  a[0] ?? 0.05,
                  a[1] ?? 0.05,
                  a[2] ?? 0.05,
                );
        world.createCollider(
          cd
            .setTranslation(c.offset[0], c.offset[1], c.offset[2])
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
        const xMin = bd.left * h.depth + 0.06;
        const xMax = bd.right * h.depth - 0.06;
        h.tx = clamp(at.x + h.ox, xMin, xMax);
        h.ty = Math.max(at.y + h.oy, bd.floorY + 0.06);
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
      reset() {
        for (const id of [...bodies.current.keys()]) {
          const b = remove(id);
          if (!b) continue;
          const e = b.entry;
          registry.setFree(e.id, false);
          e.obj.position.set(...e.def.p);
          e.obj.quaternion.set(...e.def.q);
          table.group?.add(e.obj);
        }
        held.current = null;
        scheduleEmpty();
        table.invalidate();
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
