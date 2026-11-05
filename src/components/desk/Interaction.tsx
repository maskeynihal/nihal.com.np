import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Raycaster, Vector2, Vector3, type Object3D } from 'three';
import {
  HOLD_MS,
  HOLD_SLOP_PX,
  RingBuffer,
  TAP_SLOP_PX,
  isTap,
} from '../../lib/desk/drag';
import { pxToWorld } from '../../lib/desk/view';
import { DESK_RESET_EVENT } from '../../lib/desk/bus';
import { ghostLook } from '../../lib/desk/ghost-look';
import { entryIdOf, registry } from './registry';
import { activity } from './activity';
import { physicsBridge } from './physics-bridge';
import { table } from './table';
import { setInteractionProbe } from './scene-hooks';
import { armSound } from '../../lib/sound';
import { CALLOUT_EVENT, type FlightLabel } from '../../lib/shared-callout';

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
  /** Pointer on the z = 0 world plane. */
  last: { x: number; y: number };
  ring: RingBuffer;
  /** The element that got the pointerdown (it holds the capture). */
  target: Element | null;
}

function sendDrag(active: boolean): void {
  window.dispatchEvent(new CustomEvent('nihal:drag', { detail: { active } }));
}

/**
 * Pointer, touch and keyboard input for the desk. The canvas is a fixed layer that never takes
 * events, so everything is listened to on `window`: a press is ours only when a ray from the
 * pointer hits a drawn object; any other press goes on to the page untouched. It lives in the
 * Scene chunk and talks to the physics chunk only through `physicsBridge`. Without physics a
 * press still works as a tap; a drag asks for the engine (first grab only) and waits for it with
 * the pointer still down.
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
    const figure = document.querySelector<HTMLElement>('[data-desk]');
    const html = document.documentElement;
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    let press: Press | null = null;
    let swallowClick = false;
    let hoverRaf = 0;
    let hoverAt: { x: number; y: number } | null = null;

    const canvasPoint = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect();
      return { x: cx - r.left, y: cy - r.top, w: r.width, h: r.height };
    };

    const pick = (cx: number, cy: number): string | null => {
      // Nothing is drawn where the table is off screen and nothing is free: skip the ray.
      if (!table.visible && !registry.anyFree()) return null;
      const p = canvasPoint(cx, cy);
      ndc.set((p.x / p.w) * 2 - 1, -(p.y / p.h) * 2 + 1);
      camera.updateMatrixWorld();
      raycaster.setFromCamera(ndc, camera);
      scene.updateMatrixWorld();
      const roots: Object3D[] = registry.all().map((x) => x.obj);
      const hit = raycaster.intersectObjects(roots, true)[0];
      return hit ? entryIdOf(hit.object) : null;
    };

    const toWorld = (cx: number, cy: number) => {
      const p = canvasPoint(cx, cy);
      return pxToWorld(p.x, p.y, table.viewport, table.layout.ppm);
    };

    const setCursor = (c: string) => {
      html.style.cursor = c;
    };

    const setHover = (id: string | null) => {
      if (hover.current.id === id) return;
      hover.current.id = id;
      activity.set({ hover: id });
      setCursor(id ? 'grab' : '');
      invalidate();
    };

    const navigate = (id: string) => {
      const target = registry.get(id)?.def.target;
      if (!target) return;
      // The label that flies to the section (C-03); the navigate handler picks it up.
      const label = figure?.querySelector<HTMLElement>(
        `[data-callout="${id}"]`,
      );
      const rect = label?.getBoundingClientRect();
      if (label?.textContent && rect && rect.width > 0)
        window.dispatchEvent(
          new CustomEvent<FlightLabel>(CALLOUT_EVENT, {
            detail: {
              target,
              text: label.textContent,
              rect: {
                left: rect.left,
                top: rect.top,
                width: rect.width,
                height: rect.height,
              },
            },
          }),
        );
      window.dispatchEvent(
        new CustomEvent('nihal:navigate', { detail: target }),
      );
    };

    const reset = () => {
      physicsBridge.api()?.reset();
      setHover(null);
    };

    const release = (p: Press) => {
      try {
        p.target?.releasePointerCapture(p.pointerId);
      } catch {
        // Already released.
      }
      html.style.userSelect = '';
    };

    const endPress = () => {
      if (press) {
        window.clearTimeout(press.timer);
        release(press);
      }
      press = null;
      // The click that may follow has been and gone by the next task.
      window.setTimeout(() => (swallowClick = false), 0);
      setCursor(hover.current.id ? 'grab' : '');
    };

    const tryGrab = () => {
      const p = press;
      const api = physicsBridge.api();
      if (!p || !api || p.mode === 'grabbed') return;
      const wants = p.touch ? p.mode === 'holding' : p.dragging;
      if (!wants) return;
      if (!api.grab(p.id, p.last.x, p.last.y)) return;
      p.mode = 'grabbed';
      p.ring.clear();
      p.ring.push(p.last.x, p.last.y, performance.now());
      setCursor('grabbing');
      setHover(null);
      activity.set({ grabbed: p.id });
      sendDrag(true);
      if (p.id === 'ghost') ghostLook.set({ x: p.last.x, z: 1 });
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
      activity.set({ grabbed: null });
      sendDrag(false);
    };

    const capture = (e: PointerEvent) => {
      try {
        (e.target as Element | null)?.setPointerCapture(e.pointerId);
      } catch {
        // The pointer may already be gone; the release path handles it.
      }
    };

    const onDown = (e: PointerEvent) => {
      if (press) return;
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      const t = e.target;
      // The put-back button is the page's, even where an object floats over it.
      if (t instanceof Element && t.closest('[data-desk-reset]')) return;
      const id = pick(e.clientX, e.clientY);
      if (!id) return;
      // A press is the gesture that lets a visitor who left sound on hear the desk.
      armSound();
      const touch = e.pointerType !== 'mouse';
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
        last: toWorld(e.clientX, e.clientY),
        ring: new RingBuffer(),
        target: e.target instanceof Element ? e.target : null,
      };
      press = p;
      swallowClick = true;
      html.style.userSelect = 'none';
      if (!touch) {
        e.preventDefault();
        physicsBridge.request();
        capture(e);
      } else {
        // A swipe over an object must not cost a 600 KB download: ask only once held.
        p.timer = window.setTimeout(() => {
          if (press !== p || p.mode !== 'pending') return;
          // A busy main thread can run this before the pointercancel of a swipe arrives.
          if (Math.abs(window.scrollY - p.scrollY) > 1) {
            endPress();
            return;
          }
          p.mode = 'holding';
          physicsBridge.request();
          if (p.target)
            try {
              p.target.setPointerCapture(p.pointerId);
            } catch {
              // see capture
            }
          tryGrab();
        }, HOLD_MS);
      }
    };

    const hoverPick = () => {
      hoverRaf = 0;
      if (press || !hoverAt) return;
      setHover(pick(hoverAt.x, hoverAt.y));
    };

    const onMove = (e: PointerEvent) => {
      const p = press;
      if (!p) {
        if (e.pointerType === 'mouse') {
          hoverAt = { x: e.clientX, y: e.clientY };
          if (!hoverRaf) hoverRaf = requestAnimationFrame(hoverPick);
        }
        return;
      }
      if (e.pointerId !== p.pointerId) return;
      const dist = Math.hypot(e.clientX - p.x0, e.clientY - p.y0);
      if (p.touch && p.mode === 'pending' && dist > HOLD_SLOP_PX) {
        // A swipe: the page scrolls, this is not ours.
        endPress();
        return;
      }
      const pt = toWorld(e.clientX, e.clientY);
      p.last = pt;
      if (!p.touch && !p.dragging && dist >= TAP_SLOP_PX) p.dragging = true;
      if (p.mode === 'grabbed') {
        p.ring.push(pt.x, pt.y, e.timeStamp);
        physicsBridge.api()?.move(pt.x, pt.y);
        if (p.id === 'ghost') ghostLook.set({ x: pt.x, z: 1 });
      } else tryGrab();
    };

    const onUp = (e: PointerEvent) => {
      const p = press;
      if (!p || e.pointerId !== p.pointerId) return;
      if (p.mode === 'grabbed') finishGrab(true, e.timeStamp);
      else {
        const dist = Math.hypot(e.clientX - p.x0, e.clientY - p.y0);
        if (isTap(dist, e.timeStamp - p.t0)) navigate(p.id);
      }
      endPress();
    };

    const onCancel = (e: PointerEvent) => {
      const p = press;
      if (!p || e.pointerId !== p.pointerId) return;
      finishGrab(false, e.timeStamp);
      endPress();
    };

    // The click that follows a press on an object is not for the page underneath.
    const onClick = (e: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      e.preventDefault();
      e.stopPropagation();
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
    const onSelect = (e: Event) => {
      if (press) e.preventDefault();
    };

    const isTyping = (t: EventTarget | null) =>
      t instanceof HTMLElement &&
      (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'r' && e.key !== 'R') return;
      if (e.metaKey || e.ctrlKey || e.altKey || isTyping(e.target)) return;
      reset();
    };

    // A held body stops when the page goes away.
    const onVisibility = () => {
      if (document.hidden && press) {
        finishGrab(false, performance.now());
        endPress();
      }
    };

    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('click', onClick, true);
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('contextmenu', onContext);
    window.addEventListener('selectstart', onSelect);
    window.addEventListener('keydown', onKey);
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
      cancelAnimationFrame(hoverRaf);
      unsubscribe();
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('contextmenu', onContext);
      window.removeEventListener('selectstart', onSelect);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(DESK_RESET_EVENT, reset);
      document.removeEventListener('visibilitychange', onVisibility);
      setCursor('');
      html.style.userSelect = '';
      activity.set({ hover: null, grabbed: null });
      setInteractionProbe(null);
    };
  }, [gl, camera, scene, invalidate]);

  return null;
}
