import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useThree } from '@react-three/fiber';
import {
  BallCollider,
  CapsuleCollider,
  CoefficientCombineRule,
  CuboidCollider,
  Physics,
  RigidBody,
  useAfterPhysicsStep,
  useBeforePhysicsStep,
  useRapier,
  type RapierCollider,
  type RapierRigidBody,
} from '@react-three/rapier';
import { Euler, Quaternion, type Group } from 'three';
import {
  FOLLOW,
  LIFT,
  TABLE_HALF,
  clampToDesk,
  outOfBounds,
  tiltFor,
} from '../../../lib/desk/drag';
import { feelFor } from '../../../lib/desk/materials';
import type { ObjectDef } from '../../../lib/desk/object-def';
import { registry, type RegistryEntry } from '../registry';
import { table, tableFrame } from '../table';
import { playImpact } from '../../../lib/sound';
import {
  fallBridge,
  physicsBridge,
  type HandoffLog,
  type HandoffState,
  type PhysicsApi,
} from '../physics-bridge';
import { handToFall } from './handoff';

/**
 * The table world: this file and its siblings are the only place that imports
 * `@react-three/rapier`; the Scene reaches them through a dynamic import on the first grab, so the
 * engine (about 600 KB brotli, wasm inlined) is a chunk of its own. Objects are not created here:
 * the registry holds the Object3D instances the Scene already drew, and each body takes its object
 * into its group in a layout effect (same pose, same commit, so nothing flashes) and gives it
 * back on unmount. Every body starts asleep, so an untouched desk costs no frames.
 *
 * The table is a slab with no walls. Whatever is pushed, dragged or thrown past its rim tips over
 * it for real (the slab is a collider, so the object pivots on the edge) and, once it is clear of
 * the slab and below the table top, is handed to the fall layer (`handoff.ts`, `fall-world.tsx`).
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

/** Milliseconds a body may sit somewhere no layer wants it before it is put back at its home pose. */
const WATCHDOG_MS = 1200;
/** Steps without touching the slab, past the rim and below the table top, before a handoff. */
const CLEAR_STEPS = 2;
/** Ask for the fall canvas when a body would be past the rim this soon, or is this close to it (m). */
const LOOKAHEAD_S = 0.7;
const NEAR_RIM = 0.12;
const STEP = 1 / 60;
/** The slab is the table: its top is y = 0, where the sheet is drawn. */
const SLAB_THICK = 0.05;

const NEUTRAL = {
  friction: 1,
  restitution: 0,
  frictionCombineRule: CoefficientCombineRule.Multiply,
  restitutionCombineRule: CoefficientCombineRule.Max,
} as const;

/** Signed distance past the slab's nearest edge on the table plane, metres (negative over it). */
function rimEdge(x: number, z: number): number {
  return Math.max(Math.abs(x) - TABLE_HALF.x, Math.abs(z) - TABLE_HALF.z);
}

/** How far a point is outside the slab's footprint on the table plane, metres (0 over it). */
function beyondRim(x: number, z: number): number {
  return Math.hypot(
    Math.max(Math.abs(x) - TABLE_HALF.x, 0),
    Math.max(Math.abs(z) - TABLE_HALF.z, 0),
  );
}

function Colliders({ def }: { def: ObjectDef }) {
  const c = def.collider;
  const feel = feelFor(def.model);
  const common = {
    position: c.offset,
    mass: def.mass,
    friction: feel.friction,
    restitution: feel.restitution,
    frictionCombineRule: CoefficientCombineRule.Multiply,
    restitutionCombineRule: CoefficientCombineRule.Max,
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

/** The table: one slab, no walls and no ceiling. */
function Slab({
  slabRef,
}: {
  slabRef: { current: RapierCollider | null };
}): ReactNode {
  return (
    <CuboidCollider
      ref={slabRef}
      args={[TABLE_HALF.x, SLAB_THICK, TABLE_HALF.z]}
      position={[0, -SLAB_THICK, 0]}
      {...NEUTRAL}
    />
  );
}

interface Spawn {
  p: [number, number, number];
  q: [number, number, number, number];
  v: [number, number, number];
  w: [number, number, number];
}

function Body({
  entry,
  spawn,
  handed,
  onBody,
}: {
  entry: RegistryEntry;
  spawn: Spawn | undefined;
  handed: { current: Set<string> };
  onBody: (id: string, rb: RapierRigidBody | null) => void;
}) {
  const slot = useRef<Group>(null);
  const def = entry.def;
  const feel = feelFor(def.model);

  // Take the drawn object into this body's group, keeping its world pose, and give it back to
  // the table on unmount (unless it was handed to the fall layer, which already owns it).
  useLayoutEffect(() => {
    const host = slot.current;
    if (!host) return;
    const { obj } = entry;
    host.add(obj);
    obj.position.set(0, 0, 0);
    obj.quaternion.identity();
    return () => {
      if (handed.current.has(entry.id) || entry.free) return;
      table.group?.add(obj);
      obj.position.set(...def.p);
      obj.quaternion.set(...def.q);
    };
  }, [entry, def, handed]);

  return (
    <RigidBody
      ref={(rb) => onBody(def.id, rb)}
      type="dynamic"
      colliders={false}
      position={spawn?.p ?? def.p}
      quaternion={spawn?.q ?? def.q}
      {...(spawn ? { linearVelocity: spawn.v, angularVelocity: spawn.w } : {})}
      linearDamping={feel.linearDamping}
      angularDamping={feel.angularDamping}
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

const _q = new Quaternion();
const _tilt = new Quaternion();
const _cur = new Quaternion();
const _e = new Euler();

function World({
  entries,
  setManual,
}: {
  entries: RegistryEntry[];
  setManual: (on: boolean) => void;
}) {
  const { invalidate } = useThree();
  const { rapier, step, world } = useRapier();
  const stepRef = useRef(step);
  stepRef.current = step;
  const bodies = useRef(new Map<string, RapierRigidBody>());
  const grab = useRef<Grab | null>(null);
  const outSince = useRef(new Map<string, number>());
  const speeds = useRef(new Map<string, number>());
  const handed = useRef(new Set<string>());
  const slab = useRef<RapierCollider | null>(null);
  const clear = useRef(new Map<string, number>());
  const spawns = useRef(new Map<string, Spawn>());
  const generation = useRef(new Map<string, number>());
  const log = useRef<HandoffLog[]>([]);
  const [, bump] = useState(0);
  const rerender = useCallback(() => bump((n) => n + 1), []);

  const onBody = useCallback((id: string, rb: RapierRigidBody | null) => {
    if (rb) bodies.current.set(id, rb);
    else bodies.current.delete(id);
  }, []);

  /** Back to the home pose, still, asleep. A body that went to the fall layer gets a fresh one. */
  const respawn = (entry: RegistryEntry) => {
    if (grab.current?.id === entry.id) grab.current = null;
    outSince.current.delete(entry.id);
    spawns.current.delete(entry.id);
    const rb = bodies.current.get(entry.id);
    if (handed.current.delete(entry.id) || !rb) {
      generation.current.set(
        entry.id,
        (generation.current.get(entry.id) ?? 0) + 1,
      );
      return;
    }
    const def = entry.def;
    rb.setBodyType(rapier.RigidBodyType.Dynamic, false);
    rb.setTranslation({ x: def.p[0], y: def.p[1], z: def.p[2] }, false);
    rb.setRotation(
      { x: def.q[0], y: def.q[1], z: def.q[2], w: def.q[3] },
      false,
    );
    rb.setLinvel({ x: 0, y: 0, z: 0 }, false);
    rb.setAngvel({ x: 0, y: 0, z: 0 }, false);
    rb.sleep();
    // A sleeping body is not synced by the world, so put its group (the slot's parent) there by hand.
    const group = entry.obj.parent?.parent;
    group?.position.set(...def.p);
    group?.quaternion.set(...def.q);
    entry.obj.position.set(0, 0, 0);
    entry.obj.quaternion.identity();
  };

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
    // Turn from wherever the object is to the held pose, so a tipped object rights itself over a
    // few steps instead of snapping.
    const r = g.rb.rotation();
    _cur.set(r.x, r.y, r.z, r.w).slerp(_q, 0.25);
    g.rb.setNextKinematicTranslation({ x: nx, y: ny, z: nz });
    g.rb.setNextKinematicRotation({
      x: _cur.x,
      y: _cur.y,
      z: _cur.z,
      w: _cur.w,
    });
    const moving =
      Math.abs(g.tx - nx) > 1e-4 ||
      Math.abs(g.tz - nz) > 1e-4 ||
      Math.abs(LIFT - ny) > 1e-4 ||
      Math.hypot(g.vx, g.vz) > 1e-3;
    if (moving) invalidate();
  });

  /** Moves a body into the fall layer, if it is ready; true when it did. */
  const handOver = (entry: RegistryEntry, rb: RapierRigidBody): boolean => {
    const api = fallBridge.api();
    const frame = tableFrame();
    const cam = table.camera;
    if (!api || !frame || !cam) return false;
    const t = rb.translation();
    const r = rb.rotation();
    const lv = rb.linvel();
    const av = rb.angvel();
    const state: HandoffState = {
      id: entry.id,
      p: [t.x, t.y, t.z],
      q: [r.x, r.y, r.z, r.w],
      v: [lv.x, lv.y, lv.z],
      w: [av.x, av.y, av.z],
    };
    const entryLog = handToFall(entry, state, frame, cam, api);
    if (!entryLog) return false;
    log.current.push(entryLog);
    if (log.current.length > 50) log.current.shift();
    rb.setEnabled(false);
    handed.current.add(entry.id);
    registry.setFree(entry.id, true);
    outSince.current.delete(entry.id);
    speeds.current.delete(entry.id);
    clear.current.delete(entry.id);
    rerender();
    table.invalidate();
    return true;
  };

  /** True while any part of the body touches the slab. */
  const touchingSlab = (rb: RapierRigidBody): boolean => {
    const sc = slab.current;
    if (!sc) return false;
    let hit = false;
    for (let i = 0; i < rb.numColliders() && !hit; i++)
      world.contactPair(rb.collider(i), sc, (m) => {
        if (m.numContacts() > 0) hit = true;
      });
    return hit;
  };

  useAfterPhysicsStep(() => {
    const now = performance.now();
    let away = handed.current.size > 0;
    for (const entry of entries) {
      if (handed.current.has(entry.id)) continue;
      const rb = bodies.current.get(entry.id);
      if (!rb) continue;
      const p = rb.translation();
      const held = grab.current?.id === entry.id;
      const off = beyondRim(p.x, p.z);
      // The second canvas takes a moment to come up (a new WebGL context), so it is asked for
      // early: while something is carried near the rim, and when anything is moving so that it
      // would be past the rim within a moment.
      if (fallBridge.state() === 'off' && !rb.isSleeping()) {
        const v = rb.linvel();
        const ahead = rimEdge(p.x + v.x * LOOKAHEAD_S, p.z + v.z * LOOKAHEAD_S);
        if (held ? rimEdge(p.x, p.z) > -NEAR_RIM : ahead > 0) {
          const frame = tableFrame();
          if (frame) fallBridge.request(frame);
        }
      }
      if (!held && off > 0 && !rb.isSleeping()) {
        // Clear of the slab (no contact for a few steps) and below the table top: the fall layer
        // takes it. A body that is still tipping over the rim keeps touching it, so it pivots.
        const gap = touchingSlab(rb)
          ? 0
          : (clear.current.get(entry.id) ?? 0) + 1;
        clear.current.set(entry.id, gap);
        if (
          fallBridge.state() === 'ready' &&
          gap >= CLEAR_STEPS &&
          p.y < -0.01 &&
          handOver(entry, rb)
        )
          continue;
      }
      // Safety net: a body no layer took over goes home after a while.
      if (outOfBounds(p)) {
        const since = outSince.current.get(entry.id);
        if (since === undefined) outSince.current.set(entry.id, now);
        else if (now - since >= WATCHDOG_MS) {
          respawn(entry);
          rerender();
          invalidate();
        }
      } else outSince.current.delete(entry.id);
      // A hard stop reads as an impact. Sound is off unless a press armed it.
      const lv = rb.linvel();
      const speed = Math.hypot(lv.x, lv.y, lv.z);
      const prev = speeds.current.get(entry.id) ?? 0;
      if (prev - speed > 1.2 && !held) playImpact(prev);
      speeds.current.set(entry.id, speed);
      if (off > 0.05 || p.y < -0.1) away = true;
    }
    registry.setAway(away);
  });

  useEffect(() => {
    const dropHeld = (vx: number, vz: number) => {
      const g = grab.current;
      if (!g) return;
      grab.current = null;
      g.rb.setBodyType(rapier.RigidBodyType.Dynamic, true);
      g.rb.setLinvel({ x: vx, y: 0, z: vz }, true);
      g.rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
      invalidate();
    };
    const api: PhysicsApi = {
      grab(id, x, z) {
        const rb = bodies.current.get(id);
        if (!rb || !registry.get(id) || handed.current.has(id)) return false;
        dropHeld(0, 0);
        rb.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
        rb.setAngvel({ x: 0, y: 0, z: 0 }, true);
        outSince.current.delete(id);
        const t = rb.translation();
        grab.current = {
          id,
          rb,
          tx: t.x,
          tz: t.z,
          ox: t.x - x,
          oz: t.z - z,
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
        fallBridge.api()?.reset();
        for (const e of entries) {
          const wasAway = handed.current.has(e.id);
          respawn(e);
          if (wasAway) {
            registry.setFree(e.id, false);
            e.obj.position.set(...e.def.p);
            e.obj.quaternion.set(...e.def.q);
            table.group?.add(e.obj);
          }
        }
        rerender();
        invalidate();
      },
      receive(s) {
        const entry = registry.get(s.id);
        if (!entry) return;
        spawns.current.set(s.id, { p: s.p, q: s.q, v: s.v, w: s.w });
        handed.current.delete(s.id);
        generation.current.set(s.id, (generation.current.get(s.id) ?? 0) + 1);
        registry.setFree(s.id, false);
        // Show it at once; its new body takes the object over on the next commit.
        entry.obj.position.set(...s.p);
        entry.obj.quaternion.set(...s.q);
        table.group?.add(entry.obj);
        rerender();
        invalidate();
      },
      grabbed: () => grab.current?.id ?? null,
      awake: (id) => {
        const rb = bodies.current.get(id);
        return (
          !!rb &&
          !handed.current.has(id) &&
          (grab.current?.id === id || !rb.isSleeping())
        );
      },
      bodies: () =>
        entries.flatMap((e) => {
          const rb = bodies.current.get(e.id);
          if (!rb || handed.current.has(e.id)) return [];
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
        if (!rb || handed.current.has(id)) return false;
        grab.current = grab.current?.id === id ? null : grab.current;
        rb.setBodyType(rapier.RigidBodyType.Dynamic, true);
        rb.setTranslation({ x, y, z }, true);
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
        invalidate();
        return true;
      },
      hold: (on) => setManual(on),
      step(n) {
        for (let i = 0; i < n; i++) stepRef.current(STEP);
        invalidate();
      },
      handoffs: () => [...log.current],
    };
    physicsBridge.provide(api);
    invalidate();
    return () => {
      physicsBridge.provide(null);
      grab.current = null;
      // Whatever is still in the fall layer comes home with the table.
      fallBridge.api()?.reset();
      for (const entry of registry.all()) {
        if (!entry.free) continue;
        registry.setFree(entry.id, false);
        entry.obj.position.set(...entry.def.p);
        entry.obj.quaternion.set(...entry.def.q);
        table.group?.add(entry.obj);
      }
      handed.current.clear();
    };
    // `respawn` and `handOver` close over refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rapier, invalidate, entries, setManual]);

  return (
    <>
      <Slab slabRef={slab} />
      {entries.map((entry) =>
        handed.current.has(entry.id) ? null : (
          <Body
            key={`${entry.id}:${generation.current.get(entry.id) ?? 0}`}
            entry={entry}
            spawn={spawns.current.get(entry.id)}
            handed={handed}
            onBody={onBody}
          />
        ),
      )}
    </>
  );
}

export default function PhysicsWorld({ paused }: { paused: boolean }) {
  const entries = useMemo(() => registry.all(), []);
  const [manual, setManual] = useState(false);
  return (
    <Physics
      timeStep={STEP}
      interpolate
      paused={paused || manual}
      gravity={[0, -9.81, 0]}
    >
      <World entries={entries} setManual={setManual} />
    </Physics>
  );
}
