import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Quaternion, Vector3, type PerspectiveCamera } from 'three';
import { getMotion, subscribeMotion } from '../../lib/prefs';
import {
  atRest,
  frameSpeed,
  rollAngle,
  scrollFeelFor,
  smoothSpeed,
  stepSpring,
  targetPx,
  type Spring,
} from '../../lib/desk/scroll-spring';
import { registry } from './registry';
import { physicsBridge } from './physics-bridge';
import { setMotionProbe } from './scene-hooks';

/**
 * Two small motions that need no physics (and so no physics chunk): a scroll nudges the table, so
 * every object slides a few screen pixels along it and eases back (balls most, the laptop and the
 * board barely), and one small ball rocks once after first paint so the desk shows it can be
 * played with. Only a ball turns, and only by rolling the distance it slid, about its own centre.
 * Nothing tilts, and at rest every offset and rotation is exactly zero.
 *
 * Each object's slide moves only its pivot group (`registry.pivot`, between the body's group and
 * the model), so it never touches a body, a drag, a pick or a handoff; anything held, moving or
 * free is let go to zero instead. Nothing here draws a frame unless something is moving, it is
 * off under reduced motion and while the canvas is off screen or the tab is hidden, and the
 * table canvas stays in the page flow (no transform on the page or the canvas).
 */

/** Ball that rocks once per visit, and how hard (px/s along the table, about 5 px of travel). */
/** The one ball on the desk. */
const NUDGE_IDS = ['ball-l'];
const nudgeId = () => NUDGE_IDS.find((id) => registry.get(id));
const NUDGE_SPEED = 190;
const NUDGE_DELAY_MS = 1800;
const NUDGE_KEY = 'nihal:desk-nudge';

const _q = new Quaternion();
const _r = new Quaternion();
const _inv = new Quaternion();
const _p = new Vector3();
const _c = new Vector3();
const _a = new Vector3();
const _b = new Vector3();
const AXIS_X = new Vector3(1, 0, 0);

function seen(): boolean {
  try {
    return sessionStorage.getItem(NUDGE_KEY) === '1';
  } catch {
    return false;
  }
}
function markSeen(): void {
  try {
    sessionStorage.setItem(NUDGE_KEY, '1');
  } catch {
    // Private mode: the nudge may repeat on a reload. Harmless.
  }
}

/** Screen px per metre along the table's depth axis at the table's centre, for this canvas. */
function pxPerMetre(
  cam: PerspectiveCamera,
  size: { width: number; height: number },
): number {
  cam.updateMatrixWorld();
  _a.set(0, 0, 0).project(cam);
  _b.set(0, 0, 0.1).project(cam);
  return (Math.abs(_b.y - _a.y) / 2) * size.height * 10 || 1;
}

export function ScrollMotion() {
  const { gl, invalidate, camera, size } = useThree();
  const springs = useRef(new Map<string, Spring>());
  const on = useRef({ motion: getMotion() === 'full', visible: true });
  // `acc`: page travel (px) since the last frame. `idle`: the last frame had nothing moving.
  const scroll = useRef({ y: 0, acc: 0, vel: 0, idle: true });
  const scale = useRef({ w: 0, h: 0, k: 1 });

  useEffect(() => {
    scroll.current.y = window.scrollY;
    const el = gl.domElement;
    const io =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver((es) => {
            on.current.visible = es.some((e) => e.isIntersecting);
            if (on.current.visible) invalidate();
          })
        : null;
    io?.observe(el);
    const offMotion = subscribeMotion((m) => {
      on.current.motion = m === 'full';
      invalidate();
    });
    const onScroll = () => {
      const s = scroll.current;
      s.acc += window.scrollY - s.y;
      s.y = window.scrollY;
      if (on.current.motion && on.current.visible && !document.hidden)
        invalidate();
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // The nudge: once per visit, a while after first paint, if nothing else is going on.
    let timer = 0;
    let off: (() => void) | null = null;
    const fire = () => {
      const id = nudgeId();
      const entry = id ? registry.get(id) : undefined;
      if (
        !id ||
        !entry ||
        seen() ||
        !on.current.motion ||
        !on.current.visible ||
        document.hidden ||
        entry.free ||
        physicsBridge.api()?.grabbed()
      )
        return;
      markSeen();
      const s = springs.current.get(id) ?? { x: 0, v: 0 };
      s.v += NUDGE_SPEED;
      springs.current.set(id, s);
      invalidate();
    };
    if (!seen()) {
      const arm = () => {
        if (!nudgeId() || timer) return;
        timer = window.setTimeout(fire, NUDGE_DELAY_MS);
        off?.();
        off = null;
      };
      off = registry.subscribe(arm);
      arm();
    }

    setMotionProbe(() =>
      [...springs.current].map(([id, s]) => {
        const pv = registry.get(id)?.pivot;
        return {
          id,
          x: s.x,
          v: s.v,
          off: pv ? pv.position.length() : 0,
          rot: pv ? pv.quaternion.angleTo(_r.identity()) : 0,
        };
      }),
    );
    return () => {
      io?.disconnect();
      offMotion();
      window.removeEventListener('scroll', onScroll);
      window.clearTimeout(timer);
      off?.();
      setMotionProbe(null);
      // Leave every pivot at zero for whoever uses the objects next.
      for (const e of registry.all()) {
        e.pivot.position.set(0, 0, 0);
        e.pivot.quaternion.identity();
      }
    };
  }, [gl, invalidate]);

  useFrame((_, delta) => {
    const { motion, visible } = on.current;
    const enabled = motion && visible && !document.hidden;
    const sc = scroll.current;
    if (!enabled) {
      sc.acc = 0;
      sc.vel = 0;
    }
    // Page speed over this frame, smoothed. The first frame after idle is a normal one, not the
    // whole idle gap.
    const dt = sc.idle ? 1 / 60 : Math.min(Math.max(delta, 1 / 240), 0.25);
    const inst = frameSpeed(sc.acc, dt);
    sc.acc = 0;
    sc.vel = smoothSpeed(sc.vel, inst, dt);
    if (inst === 0 && Math.abs(sc.vel) < 4) sc.vel = 0;

    const k = scale.current;
    if (k.w !== size.width || k.h !== size.height) {
      k.w = size.width;
      k.h = size.height;
      k.k = pxPerMetre(camera as PerspectiveCamera, size);
    }

    let busy = sc.vel !== 0;
    for (const e of registry.all()) {
      let s = springs.current.get(e.id);
      const feel = scrollFeelFor(e.def.model);
      // Held, moving or free: let it go. A body must never carry the pivot's offset.
      const calm = e.free || !!physicsBridge.api()?.awake(e.id);
      if (!enabled && !s) continue;
      if (!s) {
        s = { x: 0, v: 0 };
        springs.current.set(e.id, s);
      }
      if (!motion) {
        s.x = 0;
        s.v = 0;
      }
      const target = enabled && !calm ? targetPx(sc.vel, feel) : 0;
      if (motion) stepSpring(s, target, dt, calm || !enabled);
      if (atRest(s, target)) {
        s.x = 0;
        s.v = 0;
        e.pivot.position.set(0, 0, 0);
        e.pivot.quaternion.identity();
        continue;
      }
      busy = true;
      // The slide is along the table towards the viewer, in world axes; the pivot sits in the
      // object's own frame, so turn it back by the object's world rotation.
      const metres = s.x / k.k;
      e.obj.getWorldQuaternion(_q);
      _inv.copy(_q).invert();
      _p.set(0, 0, metres).applyQuaternion(_inv);
      const roll = rollAngle(metres, feel);
      if (roll === 0) {
        e.pivot.quaternion.identity();
      } else {
        // Turn about the ball's own centre (the model's origin is its contact point), around the
        // world X axis, which is the axis a ball rolling along the table turns about.
        _r.setFromAxisAngle(AXIS_X, roll);
        e.pivot.quaternion.copy(_inv).multiply(_r).multiply(_q);
        const centre = _c.set(0, feel.rollRadius, 0);
        _p.add(centre).sub(_a.copy(centre).applyQuaternion(e.pivot.quaternion));
      }
      e.pivot.position.copy(_p);
    }
    sc.idle = !busy;
    if (busy) invalidate();
  });
  return null;
}
