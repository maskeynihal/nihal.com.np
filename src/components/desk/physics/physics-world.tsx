import { useEffect, useMemo, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import {
  Physics,
  useAfterPhysicsStep,
  useBeforePhysicsStep,
  useRapier,
  type RapierCollider,
  type RapierRigidBody,
} from '@react-three/rapier';
import { Quaternion, Vector3 } from 'three';
import { FOLLOW, clamp } from '../../../lib/desk/drag';
import { atDepthZero, worldBounds } from '../../../lib/desk/view';
import { registry, type RegistryEntry } from '../registry';
import { detach, reattach, table, tableEvents } from '../table';
import { playImpact } from '../../../lib/sound';
import { physicsBridge, type PhysicsApi } from '../physics-bridge';

/**
 * The physics layer: this file is the only place that imports `@react-three/rapier`, and the
 * Scene reaches it through a dynamic import on the first grab, so the engine (about 600 KB
 * brotli, wasm inlined) is a chunk of its own.
 *
 * The world is the screen. The camera is orthographic and tilted, bodies are locked on depth
 * (z = 0), so it is a 2D fall in screen space while models still turn in 3D. The room is a floor,
 * two walls and a ceiling at the viewport edges, plus a kinematic collider that follows the table.
 * An object gets a body only once it is grabbed (it leaves the table group then and lives in world
 * coordinates); "put everything back" removes the bodies and returns the objects to the table.
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

const STEP = 1 / 60;
const FRICTION = 0.7;
const RESTITUTION = 0.25;

/** Table collider: half width and thickness, metres (the sheet is 1.6 m wide). */
const TABLE_HALF_W = 0.8;
const TABLE_THICK = 0.04;
/** The table collider is off when its top is this close to the floor or the ceiling. */
const TABLE_FLOOR_GAP = 0.25;
const TABLE_CEILING_GAP = 0.45;
/** The floor sits this far above the viewport's bottom edge so a resting object is fully on screen. */
const FLOOR_LIFT = 0.05;

interface Held {
  id: string;
  rb: RapierRigidBody;
  tx: number;
  ty: number;
  ox: number;
  oy: number;
}

const _v = new Vector3();
const _q = new Quaternion();

function World() {
  const { invalidate } = useThree();
  const { rapier, world } = useRapier();
  const bodies = useRef(new Map<string, RapierRigidBody>());
  const held = useRef<Held | null>(null);
  const room = useRef<
    { body: RapierRigidBody; colliders: RapierCollider[] } | undefined
  >(undefined);
  const tableBody = useRef<
    { body: RapierRigidBody; collider: RapierCollider } | undefined
  >(undefined);
  const speeds = useRef(new Map<string, number>());

  // The fixed room and the kinematic table collider, built once; the room follows the viewport.
  useEffect(() => {
    const body = world.createRigidBody(rapier.RigidBodyDesc.fixed());
    room.current = { body, colliders: [] };
    const tb = world.createRigidBody(
      rapier.RigidBodyDesc.kinematicPositionBased(),
    );
    const tc = world.createCollider(
      rapier.ColliderDesc.cuboid(TABLE_HALF_W, TABLE_THICK, 0.6)
        .setFriction(FRICTION)
        .setRestitution(0.1),
      tb,
    );
    tableBody.current = { body: tb, collider: tc };
    return () => {
      world.removeRigidBody(body);
      world.removeRigidBody(tb);
      room.current = undefined;
      tableBody.current = undefined;
    };
  }, [rapier, world]);

  useEffect(() => {
    const build = () => {
      const r = room.current;
      if (!r) return;
      for (const c of r.colliders) world.removeCollider(c, false);
      const { halfW, halfH } = worldBounds(table.viewport, table.layout.ppm);
      const make = (hx: number, hy: number, x: number, y: number) =>
        world.createCollider(
          rapier.ColliderDesc.cuboid(hx, hy, 1)
            .setTranslation(x, y, 0)
            .setFriction(FRICTION)
            .setRestitution(RESTITUTION),
          r.body,
        );
      const T = 0.5;
      r.colliders = [
        make(halfW + 2 * T, T, 0, -halfH + FLOOR_LIFT - T), // floor
        make(halfW + 2 * T, T, 0, halfH + T), // ceiling
        make(T, halfH + 2 * T, -halfW - T, 0), // left wall
        make(T, halfH + 2 * T, halfW + T, 0), // right wall
      ];
    };
    build();
    return tableEvents.subscribe(() => {
      build();
      // The table moved or the screen resized: let resting objects feel it.
      for (const rb of bodies.current.values()) rb.wakeUp();
      invalidate();
    });
  }, [rapier, world, invalidate]);

  const remove = (id: string) => {
    const rb = bodies.current.get(id);
    if (rb) world.removeRigidBody(rb);
    bodies.current.delete(id);
    speeds.current.delete(id);
  };

  const sendHome = (entry: RegistryEntry) => {
    if (held.current?.id === entry.id) held.current = null;
    remove(entry.id);
    reattach(entry);
  };

  const create = (entry: RegistryEntry): RapierRigidBody => {
    detach(entry);
    const { def, obj } = entry;
    obj.getWorldPosition(_v);
    obj.getWorldQuaternion(_q);
    const s = obj.scale.x;
    const z0 = atDepthZero(_v.x, _v.y, _v.z);
    obj.position.set(z0.x, z0.y, 0);
    const rb = world.createRigidBody(
      rapier.RigidBodyDesc.dynamic()
        .setTranslation(z0.x, z0.y, 0)
        .setRotation({ x: _q.x, y: _q.y, z: _q.z, w: _q.w })
        .enabledTranslations(true, true, false)
        .setLinearDamping(0.25)
        .setAngularDamping(0.7)
        .setCcdEnabled(true),
    );
    const c = def.collider;
    const a = c.args;
    const desc =
      c.kind === 'ball'
        ? rapier.ColliderDesc.ball((a[0] ?? 0.05) * s)
        : c.kind === 'capsule'
          ? rapier.ColliderDesc.capsule((a[0] ?? 0.05) * s, (a[1] ?? 0.03) * s)
          : rapier.ColliderDesc.cuboid(
              (a[0] ?? 0.05) * s,
              (a[1] ?? 0.05) * s,
              (a[2] ?? 0.05) * s,
            );
    world.createCollider(
      desc
        .setTranslation(c.offset[0] * s, c.offset[1] * s, c.offset[2] * s)
        .setMass(def.mass)
        .setFriction(FRICTION)
        .setRestitution(RESTITUTION),
      rb,
    );
    bodies.current.set(entry.id, rb);
    return rb;
  };

  // Copy every free body's pose onto its drawn object.
  const sync = () => {
    for (const entry of registry.all()) {
      if (!entry.free) continue;
      const rb = bodies.current.get(entry.id);
      if (!rb) continue;
      const t = rb.translation();
      const r = rb.rotation();
      entry.obj.position.set(t.x, t.y, t.z);
      entry.obj.quaternion.set(r.x, r.y, r.z, r.w);
    }
  };

  useBeforePhysicsStep(() => {
    const tb = tableBody.current;
    if (tb) {
      const { halfH } = worldBounds(table.viewport, table.layout.ppm);
      const top = table.world.y;
      const on =
        table.visible &&
        top > -halfH + FLOOR_LIFT + TABLE_FLOOR_GAP &&
        top < halfH - TABLE_CEILING_GAP;
      tb.collider.setEnabled(on);
      tb.body.setNextKinematicTranslation({
        x: table.world.x,
        y: top - TABLE_THICK,
        z: 0,
      });
    }
    const h = held.current;
    if (!h) return;
    const t = h.rb.translation();
    const nx = t.x + (h.tx - t.x) * FOLLOW * 3;
    const ny = t.y + (h.ty - t.y) * FOLLOW * 3;
    h.rb.setNextKinematicTranslation({ x: nx, y: ny, z: 0 });
    if (Math.abs(h.tx - nx) > 1e-4 || Math.abs(h.ty - ny) > 1e-4) invalidate();
  });

  useAfterPhysicsStep(() => {
    const { halfW, halfH } = worldBounds(table.viewport, table.layout.ppm);
    for (const entry of registry.all()) {
      if (!entry.free) continue;
      const rb = bodies.current.get(entry.id);
      if (!rb) continue;
      const p = rb.translation();
      // Watchdog: a body that escaped the room (or went NaN) goes back on the table.
      if (
        !Number.isFinite(p.x + p.y) ||
        Math.abs(p.x) > halfW + 1 ||
        p.y < -halfH - 1 ||
        p.y > halfH + 1.5
      ) {
        sendHome(entry);
        continue;
      }
      // A hard stop reads as an impact. Sound is off unless a press armed it.
      const lv = rb.linvel();
      const speed = Math.hypot(lv.x, lv.y);
      const prev = speeds.current.get(entry.id) ?? 0;
      if (prev - speed > 1.2 && held.current?.id !== entry.id) playImpact(prev);
      speeds.current.set(entry.id, speed);
    }
    sync();
  });

  useEffect(() => {
    const dropHeld = (vx: number, vy: number) => {
      const h = held.current;
      if (!h) return;
      held.current = null;
      h.rb.setBodyType(rapier.RigidBodyType.Dynamic, true);
      h.rb.setLinvel({ x: vx, y: vy, z: 0 }, true);
      h.rb.setAngvel({ x: 0, y: 0, z: -vx * 0.4 }, true);
      invalidate();
    };
    const api: PhysicsApi = {
      grab(id, x, y) {
        const entry = registry.get(id);
        if (!entry) return false;
        dropHeld(0, 0);
        const rb = bodies.current.get(id) ?? create(entry);
        const t = rb.translation();
        rb.setBodyType(rapier.RigidBodyType.KinematicPositionBased, true);
        speeds.current.set(id, 0);
        held.current = {
          id,
          rb,
          tx: t.x,
          ty: t.y,
          ox: t.x - x,
          oy: t.y - y,
        };
        sync();
        invalidate();
        return true;
      },
      move(x, y) {
        const h = held.current;
        if (!h) return;
        const { halfW, halfH } = worldBounds(table.viewport, table.layout.ppm);
        h.tx = clamp(x + h.ox, -halfW + 0.05, halfW - 0.05);
        h.ty = clamp(y + h.oy, -halfH + FLOOR_LIFT, halfH - 0.3);
        invalidate();
      },
      release: (vx, vy) => dropHeld(vx, vy),
      drop: () => dropHeld(0, 0),
      reset() {
        held.current = null;
        for (const entry of registry.all()) if (entry.free) sendHome(entry);
        invalidate();
      },
      jolt(dy) {
        const dv = clamp(dy * 0.012, -1, 1);
        for (const [id, rb] of bodies.current) {
          if (held.current?.id === id || rb.isKinematic()) continue;
          if (Math.abs(rb.linvel().y) > 1.5) continue;
          rb.applyImpulse({ x: 0, y: dv * rb.mass(), z: 0 }, true);
          rb.applyTorqueImpulse(
            { x: 0, y: 0, z: (Math.random() - 0.5) * rb.mass() * 0.02 },
            true,
          );
        }
        invalidate();
      },
      grabbed: () => held.current?.id ?? null,
      awake: (id) => {
        const rb = bodies.current.get(id);
        return !!rb && (held.current?.id === id || !rb.isSleeping());
      },
      bodies: () =>
        [...bodies.current].map(([id, rb]) => {
          const p = rb.translation();
          return {
            id,
            asleep: rb.isSleeping(),
            type: rb.isDynamic()
              ? ('dynamic' as const)
              : ('kinematic' as const),
            p: [p.x, p.y, p.z] as [number, number, number],
          };
        }),
      teleport(id, x, y, z) {
        const entry = registry.get(id);
        if (!entry) return false;
        const rb = bodies.current.get(id) ?? create(entry);
        const at = atDepthZero(x, y, z);
        if (held.current?.id === id) held.current = null;
        rb.setBodyType(rapier.RigidBodyType.Dynamic, true);
        rb.setTranslation({ x: at.x, y: at.y, z: 0 }, true);
        rb.setLinvel({ x: 0, y: 0, z: 0 }, true);
        sync();
        invalidate();
        return true;
      },
    };
    physicsBridge.provide(api);
    invalidate();
    return () => {
      physicsBridge.provide(null);
      held.current = null;
      for (const entry of registry.all()) if (entry.free) sendHome(entry);
    };
    // `create` and `sendHome` close over refs only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rapier, world, invalidate]);

  useEffect(() => restoreWarn(), []);
  return null;
}

export default function PhysicsWorld({ paused }: { paused: boolean }) {
  const gravity = useMemo(() => [0, -9.81, 0] as [number, number, number], []);
  return (
    <Physics timeStep={STEP} paused={paused} gravity={gravity}>
      <World />
    </Physics>
  );
}
