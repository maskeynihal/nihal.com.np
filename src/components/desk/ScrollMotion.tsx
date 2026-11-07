import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Quaternion, Vector3 } from 'three';
import { getMotion, subscribeMotion } from '../../lib/prefs';
import {
  atRest,
  leanFor,
  pushFor,
  scrollFeelFor,
  stepSpring,
  type Spring,
} from '../../lib/desk/scroll-spring';
import { registry } from './registry';
import { physicsBridge } from './physics-bridge';
import { setMotionProbe } from './scene-hooks';

/**
 * Two small motions that need no physics (and so no physics chunk): the objects on the table sway
 * a little with the page's scroll speed, each on its own damped spring, and one small ball rocks
 * once after first paint so the desk shows it can be played with.
 *
 * Each object's spring moves only its pivot group (`registry.pivot`, between the body's group and
 * the model), so it never touches a body, a drag, a pick or a handoff; anything held, moving or
 * free is let go to zero instead. Nothing here draws a frame unless a spring is moving, it is off
 * under reduced motion and while the canvas is off screen or the tab is hidden, and the table
 * canvas stays in the page flow (no transform on the page or the canvas).
 */

/** Ball that rocks once per visit, and how hard (m/s along the table, about 5 px of travel). */
const NUDGE_ID = 'ball-s';
const NUDGE_SPEED = 0.6;
const NUDGE_DELAY_MS = 1800;
const NUDGE_KEY = 'nihal:desk-nudge';

const _q = new Quaternion();
const _t = new Quaternion();
const _inv = new Quaternion();
const _p = new Vector3();
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

export function ScrollMotion() {
  const { gl, invalidate } = useThree();
  const springs = useRef(new Map<string, Spring>());
  const on = useRef({ motion: getMotion() === 'full', visible: true });
  const scroll = useRef({ y: 0, t: 0, vel: 0, pk: 0 });

  useEffect(() => {
    scroll.current.y = window.scrollY;
    scroll.current.t = performance.now();
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
      const now = performance.now();
      const s = scroll.current;
      const dt = now - s.t;
      if (dt < 4) return;
      const inst = ((window.scrollY - s.y) / dt) * 1000;
      s.vel = s.vel * 0.5 + inst * 0.5;
      // A slow frame must not miss a push that came and went between two frames.
      if (Math.abs(s.vel) > Math.abs(s.pk)) s.pk = s.vel;
      s.y = window.scrollY;
      s.t = now;
      if (on.current.motion && on.current.visible && !document.hidden)
        invalidate();
    };
    window.addEventListener('scroll', onScroll, { passive: true });

    // The nudge: once per visit, a while after first paint, if nothing else is going on.
    let timer = 0;
    let off: (() => void) | null = null;
    const fire = () => {
      const entry = registry.get(NUDGE_ID);
      if (
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
      const s = springs.current.get(NUDGE_ID) ?? { x: 0, v: 0 };
      s.v += NUDGE_SPEED;
      springs.current.set(NUDGE_ID, s);
      invalidate();
    };
    if (!seen()) {
      const arm = () => {
        if (!registry.get(NUDGE_ID) || timer) return;
        timer = window.setTimeout(fire, NUDGE_DELAY_MS);
        off?.();
        off = null;
      };
      off = registry.subscribe(arm);
      arm();
    }

    setMotionProbe(() =>
      [...springs.current].map(([id, s]) => ({ id, x: s.x, v: s.v })),
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

  useFrame((_, dt) => {
    const { motion, visible } = on.current;
    const enabled = motion && visible && !document.hidden;
    const sc = scroll.current;
    // The page's speed decays when no scroll event arrives.
    if (performance.now() - sc.t > 60) sc.vel *= Math.exp(-dt * 14);
    if (Math.abs(sc.vel) < 5) sc.vel = 0;
    const vel = Math.abs(sc.pk) > Math.abs(sc.vel) ? sc.pk : sc.vel;
    sc.pk = 0;
    let busy = false;
    for (const e of registry.all()) {
      let s = springs.current.get(e.id);
      const feel = scrollFeelFor(e.def.model);
      // Held, moving or free: let the spring go. A body must never carry the pivot's offset.
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
      const target = enabled && !calm ? pushFor(vel, feel) : 0;
      if (motion) stepSpring(s, target, dt, calm || !enabled);
      if (atRest(s, target)) {
        s.x = 0;
        s.v = 0;
        if (e.pivot.position.lengthSq() !== 0) {
          e.pivot.position.set(0, 0, 0);
          e.pivot.quaternion.identity();
        }
        continue;
      }
      busy = true;
      // The shift is along the table towards the viewer, in world axes; the pivot sits in the
      // object's own frame, so turn it back by the object's world rotation.
      e.obj.getWorldQuaternion(_q);
      _inv.copy(_q).invert();
      e.pivot.position.copy(_p.set(0, 0, s.x).applyQuaternion(_inv));
      _t.setFromAxisAngle(AXIS_X, leanFor(s.x, feel));
      e.pivot.quaternion.copy(_inv).multiply(_t).multiply(_q);
    }
    if (busy) invalidate();
  });
  return null;
}
