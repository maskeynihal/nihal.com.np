import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Raycaster, Vector2, Vector3, type Object3D } from 'three';
import {
  DOUBLE_TAP_MS,
  HOLD_MS,
  HOLD_SLOP_PX,
  RingBuffer,
  TAP_SLOP_PX,
  isTap,
  planePoint,
} from '../../lib/desk/drag';
import { DESK_RESET_EVENT } from '../../lib/desk/bus';
import { ghostLook } from '../../lib/desk/ghost-look';
import { entryIdOf, registry } from './registry';
import { physicsBridge } from './physics-bridge';
import { setInteractionProbe } from './scene-hooks';

/** Height of the plane the pointer is projected onto while dragging, metres. */
const PLANE_Y = 0.03;
/** Hover lift of the drawn model (not the body), metres. */
const HOVER_LIFT = 0.004;

interface Press {
  id: string;
  pointerId: number;
  touch: boolean;
  x0: number;
  y0: number;
  t0: number;
  /** pending: neither a tap nor a grab yet. holding: touch hold elapsed. grabbed: body follows. */
  mode: 'pending' | 'holding' | 'grabbed';
  /** Mouse: moved past the tap slop, so it wants to drag. */
  dragging: boolean;
  timer: number | undefined;
  /** Page scroll position at pointerdown: a page that moved is a swipe, not a hold. */
  scrollY: number;
  last: { x: number; z: number };
  ring: RingBuffer;
}

interface Empty {
  x0: number;
  y0: number;
  t0: number;
  pointerId: number;
}

function sendDrag(active: boolean): void {
  window.dispatchEvent(new CustomEvent('nihal:drag', { detail: { active } }));
}

/**
 * Pointer, touch and keyboard input for the desk (design 4.6). It lives in the Scene chunk
 * and talks to the physics chunk only through `physicsBridge`. Without physics a press still
 * works as a tap; a drag asks for the engine (first grab only) and waits for it with the
 * pointer still down.
 */
export function Interaction() {
  const { gl, camera, scene, invalidate } = useThree();
  const hover = useRef({ id: null as string | null });
  const lift = useRef(new Map<string, number>());

  // Hover lift: ease the model root up 4 mm, converge, stop rendering.
  useFrame(() => {
    let moving = false;
    for (const entry of registry.all()) {
      const want = hover.current.id === entry.id ? HOVER_LIFT : 0;
      const cur = lift.current.get(entry.id) ?? 0;
      if (cur === want) continue;
      const next =
        Math.abs(want - cur) < 1e-5 ? want : cur + (want - cur) * 0.4;
      lift.current.set(entry.id, next);
      entry.lift.position.y = next;
      if (next !== want) moving = true;
    }
    if (moving) invalidate();
  });

  useEffect(() => {
    const el = gl.domElement;
    const figure = el.closest<HTMLElement>('[data-desk]');
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    let press: Press | null = null;
    let empty: Empty | null = null;
    let lastTap = 0;
    let overCanvas = false;

    const aim = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      ndc.set(
        ((e.clientX - r.left) / r.width) * 2 - 1,
        -((e.clientY - r.top) / r.height) * 2 + 1,
      );
      camera.updateMatrixWorld();
      raycaster.setFromCamera(ndc, camera);
    };

    const pick = (e: PointerEvent): string | null => {
      aim(e);
      scene.updateMatrixWorld();
      const roots: Object3D[] = registry.all().map((x) => x.obj);
      const hit = raycaster.intersectObjects(roots, true)[0];
      return hit ? entryIdOf(hit.object) : null;
    };

    const onPlane = (e: PointerEvent): { x: number; z: number } | null => {
      aim(e);
      const { origin, direction } = raycaster.ray;
      return planePoint(
        [origin.x, origin.y, origin.z],
        [direction.x, direction.y, direction.z],
        PLANE_Y,
      );
    };

    const setHover = (id: string | null) => {
      if (hover.current.id === id) return;
      hover.current.id = id;
      el.style.cursor = id ? 'grab' : '';
      invalidate();
    };

    const navigate = (id: string) => {
      const target = registry.get(id)?.def.target;
      if (target)
        window.dispatchEvent(
          new CustomEvent('nihal:navigate', { detail: target }),
        );
    };

    const reset = () => {
      physicsBridge.api()?.reset();
      setHover(null);
    };

    const endPress = () => {
      if (press) window.clearTimeout(press.timer);
      press = null;
      el.style.cursor = hover.current.id ? 'grab' : '';
    };

    const tryGrab = () => {
      const p = press;
      const api = physicsBridge.api();
      if (!p || !api || p.mode === 'grabbed') return;
      const wants = p.touch ? p.mode === 'holding' : p.dragging;
      if (!wants) return;
      if (!api.grab(p.id, p.last.x, p.last.z)) return;
      p.mode = 'grabbed';
      p.ring.clear();
      p.ring.push(p.last.x, p.last.z, performance.now());
      try {
        el.setPointerCapture(p.pointerId);
      } catch {
        // The pointer may already be gone; the release path handles it.
      }
      el.style.cursor = 'grabbing';
      setHover(null);
      sendDrag(true);
      if (p.id === 'ghost') ghostLook.set({ x: p.last.x, z: p.last.z });
    };

    const finishGrab = (throwIt: boolean, now: number) => {
      const p = press;
      const api = physicsBridge.api();
      if (!p || p.mode !== 'grabbed') return;
      if (p.id === 'ghost') ghostLook.set(null);
      if (api) {
        if (throwIt) {
          const v = p.ring.velocity(now);
          api.release(v.x, v.z);
        } else api.drop();
      }
      sendDrag(false);
    };

    const onDown = (e: PointerEvent) => {
      if (press) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const id = pick(e);
      const touch = e.pointerType !== 'mouse';
      if (!id) {
        empty = touch
          ? {
              x0: e.clientX,
              y0: e.clientY,
              t0: e.timeStamp,
              pointerId: e.pointerId,
            }
          : null;
        return;
      }
      const pt = onPlane(e) ?? { x: 0, z: 0 };
      const p: Press = {
        id,
        pointerId: e.pointerId,
        touch,
        x0: e.clientX,
        y0: e.clientY,
        t0: e.timeStamp,
        mode: 'pending',
        dragging: false,
        timer: undefined,
        scrollY: window.scrollY,
        last: pt,
        ring: new RingBuffer(),
      };
      press = p;
      if (touch) {
        // A swipe over the canvas must not cost a 600 KB download: ask only once held.
        p.timer = window.setTimeout(() => {
          if (press !== p || p.mode !== 'pending') return;
          // A busy main thread can run this before the pointercancel of a swipe arrives.
          if (Math.abs(window.scrollY - p.scrollY) > 1) {
            endPress();
            return;
          }
          p.mode = 'holding';
          physicsBridge.request();
          try {
            el.setPointerCapture(p.pointerId);
          } catch {
            // see tryGrab
          }
          tryGrab();
        }, HOLD_MS);
      } else {
        physicsBridge.request();
        try {
          el.setPointerCapture(e.pointerId);
        } catch {
          // see tryGrab
        }
      }
    };

    const onMove = (e: PointerEvent) => {
      const p = press;
      if (!p) {
        if (e.pointerType === 'mouse') setHover(pick(e));
        return;
      }
      if (e.pointerId !== p.pointerId) return;
      const dist = Math.hypot(e.clientX - p.x0, e.clientY - p.y0);
      if (p.touch && p.mode === 'pending' && dist > HOLD_SLOP_PX) {
        // A swipe: the page scrolls, this is not ours.
        endPress();
        return;
      }
      const pt = onPlane(e);
      if (pt) p.last = pt;
      if (!p.touch && !p.dragging && dist >= TAP_SLOP_PX) p.dragging = true;
      if (p.mode === 'grabbed') {
        if (pt) {
          p.ring.push(pt.x, pt.z, e.timeStamp);
          physicsBridge.api()?.move(pt.x, pt.z);
          if (p.id === 'ghost') ghostLook.set({ x: pt.x, z: pt.z });
        }
      } else tryGrab();
    };

    const onUp = (e: PointerEvent) => {
      const p = press;
      if (!p) {
        if (empty && e.pointerId === empty.pointerId) {
          const dist = Math.hypot(e.clientX - empty.x0, e.clientY - empty.y0);
          if (isTap(dist, e.timeStamp - empty.t0)) {
            if (e.timeStamp - lastTap < DOUBLE_TAP_MS) {
              lastTap = 0;
              reset();
            } else lastTap = e.timeStamp;
          }
          empty = null;
        }
        return;
      }
      if (e.pointerId !== p.pointerId) return;
      if (p.mode === 'grabbed') finishGrab(true, e.timeStamp);
      else {
        const dist = Math.hypot(e.clientX - p.x0, e.clientY - p.y0);
        if (isTap(dist, e.timeStamp - p.t0)) navigate(p.id);
      }
      try {
        el.releasePointerCapture(p.pointerId);
      } catch {
        // Already released.
      }
      endPress();
    };

    const onCancel = (e: PointerEvent) => {
      empty = null;
      const p = press;
      if (!p || e.pointerId !== p.pointerId) return;
      finishGrab(false, e.timeStamp);
      endPress();
    };

    // Touch: the page scrolls unless a body is held. Listened to non-passively so a held
    // body can stop the scroll; a plain swipe never reaches preventDefault.
    const onTouchMove = (e: TouchEvent) => {
      const p = press;
      if (!p) return;
      if (p.mode !== 'pending') {
        if (e.cancelable) e.preventDefault();
        return;
      }
      // Touch events arrive at once while pointermove waits for the next frame, so a swipe is
      // told apart here: moving before the hold elapses hands the gesture to the page.
      const t = e.touches[0];
      if (t && Math.hypot(t.clientX - p.x0, t.clientY - p.y0) > HOLD_SLOP_PX)
        endPress();
    };
    const onContext = (e: Event) => {
      if (press) e.preventDefault();
    };
    const onLeave = () => {
      overCanvas = false;
      if (!press) setHover(null);
    };
    const onEnter = () => {
      overCanvas = true;
    };

    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'r' && e.key !== 'R') return;
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      reset();
    };
    const onWindowKey = (e: KeyboardEvent) => {
      if (overCanvas) onKey(e);
    };

    // A held body stops when the pointer or the page goes away.
    const onVisibility = () => {
      if (document.hidden && press) {
        finishGrab(false, performance.now());
        endPress();
      }
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onCancel);
    el.addEventListener('pointerleave', onLeave);
    el.addEventListener('pointerenter', onEnter);
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('contextmenu', onContext);
    figure?.addEventListener('keydown', onKey);
    window.addEventListener('keydown', onWindowKey);
    window.addEventListener(DESK_RESET_EVENT, reset);
    document.addEventListener('visibilitychange', onVisibility);
    // A grab that was waiting for the engine starts as soon as it is there.
    const unsubscribe = physicsBridge.subscribe(tryGrab);

    setInteractionProbe({
      pick(id) {
        const entry = registry.get(id);
        if (!entry) return null;
        entry.obj.updateWorldMatrix(true, false);
        const o = entry.def.collider.offset;
        const p = new Vector3(o[0], o[1], o[2])
          .applyMatrix4(entry.obj.matrixWorld)
          .project(camera);
        const r = el.getBoundingClientRect();
        return {
          x: ((p.x + 1) / 2) * r.width,
          y: ((1 - p.y) / 2) * r.height,
        };
      },
      hovered: () => hover.current.id,
      lift: (id) => registry.get(id)?.lift.position.y ?? 0,
    });

    return () => {
      if (press?.mode === 'grabbed') finishGrab(false, performance.now());
      endPress();
      unsubscribe();
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('pointerleave', onLeave);
      el.removeEventListener('pointerenter', onEnter);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('contextmenu', onContext);
      figure?.removeEventListener('keydown', onKey);
      window.removeEventListener('keydown', onWindowKey);
      window.removeEventListener(DESK_RESET_EVENT, reset);
      document.removeEventListener('visibilitychange', onVisibility);
      el.style.cursor = '';
      setInteractionProbe(null);
    };
  }, [gl, camera, scene, invalidate]);

  return null;
}
