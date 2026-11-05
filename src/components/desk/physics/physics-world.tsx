import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  type ReactNode,
} from 'react';
import { useThree } from '@react-three/fiber';
import {
  BallCollider,
  CapsuleCollider,
  CuboidCollider,
  Physics,
  RigidBody,
  useAfterPhysicsStep,
  useBeforePhysicsStep,
  useRapier,
  type RapierRigidBody,
} from '@react-three/rapier';
import { Euler, Quaternion, Vector3, type Group } from 'three';
import {
  DESK_HALF,
  FOLLOW,
  LIFT,
  clampToDesk,
  outOfBounds,
  tiltFor,
} from '../../../lib/desk/drag';
import type { ObjectDef } from '../../../lib/desk/object-def';
import { registry, type RegistryEntry } from '../registry';
import { playImpact } from '../../../lib/sound';
import { physicsBridge, type PhysicsApi } from '../physics-bridge';

/**
 * The physics layer: this file is the only place that imports `@react-three/rapier`, and the
 * Scene reaches it through a dynamic import on the first grab, so the engine (about 600 KB
 * brotli, wasm inlined) is a chunk of its own. Objects are not created here: the registry holds
 * the Object3D instances the Scene already drew, and each body takes its object into its group
 * in a layout effect (same pose, same commit, so nothing flashes) and gives it back on unmount.
 * Every body starts asleep, so an untouched desk costs no frames.
 */

// rapier3d-compat 0.19 calls its wasm-bindgen `init` with the old positional argument and
// warns on the console about it. Drop only that notice from module load until the world is
// built, so the page console stays clean. Remove with a rapier release that passes an object.
const initNotice =
  /^using deprecated parameters for the initialization function/;
const nativeWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && initNotice.test(args[0])) return;
  nativeWarn.apply(console, args);
};
const restoreWarn = () => {
  if (console.warn !== nativeWarn) console.warn = nativeWarn;
};
setTimeout(restoreWarn, 15_000);

/** Seconds out of bounds before a body is put back at its home pose (the verify line is 2 s). */
const WATCHDOG_MS = 1200;
const STEP = 1 / 60;
const THICK = 0.25;
const WALL_H = 0.5;
const CEILING = 0.9;

const FRICTION = 0.7;
const RESTITUTION = 0.12;

type BodyKind = 'dynamic' | 'kinematicPosition';
const startType = (def: ObjectDef): BodyKind =>
  def.kinematicWhenIdle ? 'kinematicPosition' : 'dynamic';

function Colliders({ def }: { def: ObjectDef }) {
  const c = def.collider;
  const common = {
    position: c.offset,
    mass: def.mass,
    friction: FRICTION,
    restitution: RESTITUTION,
  };
  if (c.kind === 'ball')
    return <BallCollider args={[c.args[0] ?? 0.05]} {...common} />;
  if (c.kind === 'capsule')
    return (
      <CapsuleCollider
        args={[c.args[0] ?? 0.05, c.args[1] ?? 0.03]}
        {...common}
      />
    );
  return (
    <CuboidCollider
      args={[c.args[0] ?? 0.05, c.args[1] ?? 0.05, c.args[2] ?? 0.05]}
      {...common}
    />
  );
}

/** Floor, four walls and a ceiling, thick enough that a 4 m/s throw cannot tunnel through. */
function Room(): ReactNode {
  const w = DESK_HALF.x;
  const d = DESK_HALF.z;
  const common = { friction: FRICTION, restitution: RESTITUTION };
  return (
    <>
      <CuboidCollider
        args={[w + 2 * THICK, THICK, d + 2 * THICK]}
        position={[0, -THICK, 0]}
        {...common}
      />
      <CuboidCollider
        args={[THICK, WALL_H, d + 2 * THICK]}
        position={[-(w + THICK), WALL_H, 0]}
        {...common}
      />
      <CuboidCollider
        args={[THICK, WALL_H, d + 2 * THICK]}
        position={[w + THICK, WALL_H, 0]}
        {...common}
      />
      <CuboidCollider
        args={[w + 2 * THICK, WALL_H, THICK]}
        position={[0, WALL_H, -(d + THICK)]}
        {...common}
      />
      <CuboidCollider
        args={[w + 2 * THICK, WALL_H, THICK]}
        position={[0, WALL_H, d + THICK]}
        {...common}
      />
      <CuboidCollider
        args={[w + 2 * THICK, THICK, d + 2 * THICK]}
        position={[0, CEILING + THICK, 0]}
        {...common}
      />
    </>
  );
}

function Body({
  entry,
  onBody,
}: {
  entry: RegistryEntry;
  onBody: (id: string, rb: RapierRigidBody) => void;
}) {
  const slot = useRef<Group>(null);
  const def = entry.def;

  // Take the drawn object into this body's group. The group is created at the home pose, the
  // object keeps only its local offset (an explode offset, if the page is mid-scroll), so the
  // world pose is unchanged and nothing flashes.
  useLayoutEffect(() => {
    const host = slot.current;
    if (!host) return;
    const { obj } = entry;
    const offset = new Vector3(...obj.position).sub(new Vector3(...def.p));
    host.add(obj);
    obj.position.copy(offset);
    obj.quaternion.identity();
    registry.setBodyGroup(entry.id, host.parent);
    return () => {
      registry.setBodyGroup(entry.id, null);
      entry.parent?.add(obj);
      obj.position.set(...def.p);
      obj.quaternion.set(...def.q);
    };
  }, [entry, def]);

  return (
    <RigidBody
      ref={(rb) => {
        if (rb) onBody(def.id, rb);
      }}
      onCollisionEnter={({ target, other }) => {
        // Peak of the last few velocity samples: the body's velocity now is already the
        // bounced one. Sound is off unless a press armed it, so this is a no-op by default.
        const speed = Math.max(
          speeds.get(target.rigidBody?.handle ?? -1) ?? 0,
          speeds.get(other.rigidBody?.handle ?? -1) ?? 0,
        );
        playImpact(speed);
      }}
      type={startType(def)}
      colliders={false}
      position={def.p}
      quaternion={def.q}
      linearDamping={0.6}
      angularDamping={0.8}
      ccd
    >
      <group ref={slot} />
      <Colliders def={def} />
    </RigidBody>
  );
}

interface Grab {
  id: string;
  rb: RapierRigidBody;
  tx: number;
  tz: number;
  ox: number;
  oz: number;
  vx: number;
  vz: number;
}

/**
 * Peak speed of each body (by handle) over the steps of the current frame, m/s. The engine
 * runs every step of a frame, then reports that frame's contacts, so a hard fall that ends in the
 * same frame has already lost its speed by then; the peak is what the tap is scaled by.
 */
const speeds = new Map<number, number>();

let lastStepAt = 0;
const FRAME_GAP_MS = 8;

const _v = new Vector3();
const _q = new Quaternion();
const _tilt = new Quaternion();
const _e = new Euler();

function World({ entries }: { entries: RegistryEntry[] }) {
  const { invalidate } = useThree();
  const { rapier } = useRapier();
  const bodies = useRef(new Map<string, RapierRigidBody>());
  const grab = useRef<Grab | null>(null);
  const outSince = useRef(new Map<string, number>());
  const settle = useRef(new Set<string>());

  const onBody = useCallback((id: string, rb: RapierRigidBody) => {
    bodies.current.set(id, rb);
  }, []);

  const type = useCallback(
    (kind: BodyKind) =>
      kind === 'dynamic'
        ? rapier.RigidBodyType.Dynamic
        : rapier.RigidBodyType.KinematicPositionBased,
    [rapier],
  );

  /** Back to the home pose, still, asleep, in its starting body type. */
  const respawn = useCallback(
    (entry: RegistryEntry) => {
      const rb = bodies.current.get(entry.id);
      if (!rb) return;
      const def = entry.def;
      if (grab.current?.id === entry.id) grab.current = null;
      settle.current.delete(entry.id);
      outSince.current.delete(entry.id);
      rb.setBodyType(type(startType(def)), false);
      rb.setTranslation({ x: def.p[0], y: def.p[1], z: def.p[2] }, false);
      rb.setRotation(
        { x: def.q[0], y: def.q[1], z: def.q[2], w: def.q[3] },
        false,
      );
      rb.setLinvel({ x: 0, y: 0, z: 0 }, false);
      rb.setAngvel({ x: 0, y: 0, z: 0 }, false);
      rb.sleep();
      // A sleeping body is not synced by the world, so put its group there by hand.
      entry.bodyGroup?.position.set(...def.p);
      entry.bodyGroup?.quaternion.set(...def.q);
      entry.obj.position.set(0, 0, 0);
      entry.obj.quaternion.identity();
    },
    [type],
  );

  useEffect(() => restoreWarn(), []);

  // Everything starts asleep. This effect belongs to the parent of every body, so it runs after
  // theirs (the body's own options effect wakes it once while it applies the type).
  useEffect(() => {
    for (const rb of bodies.current.values()) rb.sleep();
  }, []);

  useBeforePhysicsStep(() => {
    const g = grab.current;
    if (!g) return;
    const t = g.rb.translation();
    const nx = t.x + (g.tx - t.x) * FOLLOW;
    const nz = t.z + (g.tz - t.z) * FOLLOW;
    const ny = t.y + (LIFT - t.y) * FOLLOW;
    g.vx += ((nx - t.x) / STEP - g.vx) * 0.3;
    g.vz += ((nz - t.z) / STEP - g.vz) * 0.3;
    const tilt = tiltFor(g.vx, g.vz);
    const entry = registry.get(g.id);
    const home = entry?.def.q ?? [0, 0, 0, 1];
    _tilt.setFromEuler(_e.set(tilt.pitch, 0, tilt.roll));
    _q.set(home[0], home[1], home[2], home[3]).premultiply(_tilt);
    g.rb.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
    g.rb.setNextKinematicRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w });
    const moving =
      Math.abs(g.tx - nx) > 1e-4 ||
      Math.abs(g.tz - nz) > 1e-4 ||
      Math.abs(LIFT - ny) > 1e-4 ||
      Math.hypot(g.vx, g.vz) > 1e-3;
    if (moving) invalidate();
  });

  useAfterPhysicsStep(() => {
    const now = performance.now();
    // A pause of a few ms since the last step means a new frame: forget the last frame's peaks.
    if (now - lastStepAt > FRAME_GAP_MS) speeds.clear();
    lastStepAt = now;
    for (const entry of entries) {
      const rb = bodies.current.get(entry.id);
      if (!rb) continue;
      // A thrown kinematic-when-idle body (the ghost) goes back to kinematic once it sleeps.
      if (settle.current.has(entry.id) && rb.isSleeping()) {
        settle.current.delete(entry.id);
        rb.setBodyType(type('kinematicPosition'), false);
      }
      const held = grab.current?.id === entry.id ? grab.current : null;
      const lv = rb.linvel();
      const now1 = held
        ? Math.hypot(held.vx, held.vz)
        : Math.hypot(lv.x, lv.y, lv.z);
      speeds.set(rb.handle, Math.max(speeds.get(rb.handle) ?? 0, now1));
      const p = rb.translation();
      if (outOfBounds(p)) {
        const since = outSince.current.get(entry.id);
        if (since === undefined) outSince.current.set(entry.id, now);
        else if (now - since >= WATCHDOG_MS) {
          respawn(entry);
          invalidate();
        }
      } else outSince.current.delete(entry.id);
    }
  });

  useEffect(() => {
    const dropHeld = (vx: number, vz: number) => {
      const g = grab.current;
      if (!g) return;
      grab.current = null;
      g.rb.setBodyType(type('dynamic'), true);
      g.rb.setLinvel({ x: vx, y: 0, z: vz }, true);
      g.rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      if (registry.get(g.id)?.def.kinematicWhenIdle) settle.current.add(g.id);
      invalidate();
    };
    const api: PhysicsApi = {
      grab(id, x, z) {
        const rb = bodies.current.get(id);
        const entry = registry.get(id);
        if (!rb || !entry) return false;
        dropHeld(0, 0);
        // Start from where the object is drawn (an explode offset included), without a jump.
        entry.obj.updateWorldMatrix(true, false);
        entry.obj.getWorldPosition(_v);
        rb.setBodyType(type('kinematicPosition'), true);
        rb.setTranslation({ x: _v.x, y: _v.y, z: _v.z }, true);
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
        rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
        entry.bodyGroup?.position.copy(_v);
        entry.obj.position.set(0, 0, 0);
        settle.current.delete(id);
        outSince.current.delete(id);
        grab.current = {
          id,
          rb,
          tx: _v.x,
          tz: _v.z,
          ox: _v.x - x,
          oz: _v.z - z,
          vx: 0,
          vz: 0,
        };
        invalidate();
        return true;
      },
      move(x, z) {
        const g = grab.current;
        if (!g) return;
        const t = clampToDesk(x + g.ox, z + g.oz);
        g.tx = t.x;
        g.tz = t.z;
        invalidate();
      },
      release: (vx, vz) => dropHeld(vx, vz),
      drop: () => dropHeld(0, 0),
      reset() {
        grab.current = null;
        for (const e of entries) respawn(e);
        invalidate();
      },
      grabbed: () => grab.current?.id ?? null,
      awake: (id) => {
        const rb = bodies.current.get(id);
        return !!rb && (grab.current?.id === id || !rb.isSleeping());
      },
      bodies: () =>
        entries.flatMap((e) => {
          const rb = bodies.current.get(e.id);
          if (!rb) return [];
          const p = rb.translation();
          return [
            {
              id: e.id,
              asleep: rb.isSleeping(),
              type: rb.isDynamic()
                ? ('dynamic' as const)
                : ('kinematic' as const),
              p: [p.x, p.y, p.z] as [number, number, number],
            },
          ];
        }),
      teleport(id, x, y, z) {
        const rb = bodies.current.get(id);
        if (!rb) return false;
        grab.current = grab.current?.id === id ? null : grab.current;
        rb.setBodyType(type('dynamic'), true);
        rb.setTranslation({ x, y, z }, true);
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
        if (registry.get(id)?.def.kinematicWhenIdle) settle.current.add(id);
        invalidate();
        return true;
      },
    };
    physicsBridge.provide(api);
    invalidate();
    return () => physicsBridge.provide(null);
  }, [entries, invalidate, respawn, type]);

  return (
    <>
      <Room />
      {entries.map((entry) => (
        <Body key={entry.id} entry={entry} onBody={onBody} />
      ))}
    </>
  );
}

export default function PhysicsWorld({ paused }: { paused: boolean }) {
  const entries = useMemo(() => registry.all(), []);
  return (
    <Physics
      timeStep={STEP}
      interpolate
      paused={paused}
      gravity={[0, -9.81, 0]}
    >
      <World entries={entries} />
    </Physics>
  );
}
