import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Raycaster, Vector2, Vector3, type Object3D } from 'three';
import {
  HOLD_MS,
  HOLD_SLOP_PX,
  RingBuffer,
  TAP_SLOP_PX,
  isTap,
  planePoint,
} from '../../lib/desk/drag';
import { DESK_RESET_EVENT } from '../../lib/desk/bus';
import { ghostLook } from '../../lib/desk/ghost-look';
import { bumpOffset, reactions } from '../../lib/desk/reactions';
import { DURATION_FAST, DURATION_SLOW } from '../../lib/desk/tokens';
import { entryIdOf, registry } from './registry';
import { fallBridge, physicsBridge } from './physics-bridge';
import { setInteractionProbe } from './scene-hooks';
import { armSound } from '../../lib/sound';

/** Height of the plane the pointer is projected onto while dragging on the table, metres. */
const PLANE_Y = 0.03;
/** Hover lift of the drawn model (not the body), metres. */
const HOVER_LIFT = 0.004;
/** Furniture swells a little instead (it cannot be picked up): 2 %. */
const HOVER_SWELL = 0.02;
/**
 * A tap on something with a section waits this long before it scrolls there, so the reaction (the
 * screen changing, the sip) is seen first. The Scene only runs with motion on, so this is always the case.
 */
const NAVIGATE_DELAY_MS = DURATION_SLOW + DURATION_FAST;

/** Which canvas the pressed object is drawn in: the table's, or the fall layer's. */
type Layer = 'table' | 'fall';

interface Press {
  id: string;
  /** What a tap does: usually `id`; the handset on the desk kit is `handset`. */
  act: string;
  layer: Layer;
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
  /** Pointer: table layer, on the drag plane (metres, x and z); fall layer, viewport px (x and y). */
  last: { x: number; y: number };
  ring: RingBuffer;
  /** The element that got the pointerdown (it holds the capture). */
  target: Element | null;
}

function sendDrag(active: boolean): void {
  window.dispatchEvent(new CustomEvent('nihal:drag', { detail: { active } }));
}

/**
 * Pointer, touch and keyboard input for the desk. Neither canvas takes events (the table canvas
 * overlaps the text around it, the fall layer covers the page), so everything is listened to on
 * `window`: a press is ours only when a ray from the pointer hits a drawn object, in the fall layer
 * first (it is drawn on top) and then on the table; any other press goes on to the page untouched.
 * The table canvas's rectangle is read when a pointer event needs it, never per frame. It lives in the
 * Scene chunk and talks to the physics chunk only through `physicsBridge`. Without physics a
 * press still works as a tap; a drag asks for the engine (first grab only) and waits for it with
 * the pointer still down.
 */
export function Interaction() {
  const { gl, camera, scene, invalidate } = useThree();
  const hover = useRef({ id: null as string | null });
  const lift = useRef(new Map<string, number>());
  const bumping = useRef(new Set<string>());

  // Hover: a loose object eases up 4 mm, furniture swells 2 %; both converge, then rendering stops.
  // A tap's hop or buzz moves `fx` (never the body) and keeps the frames coming while it runs.
  useFrame((_, rawDelta) => {
    let moving = false;
    const now = performance.now();
    // hover settles in about the fast duration (the site's 160 ms), whatever the frame rate
    const catchUp =
      1 - Math.exp((-3 * Math.min(rawDelta, 0.1)) / (DURATION_FAST / 1000));
    for (const entry of registry.pickable()) {
      const want = hover.current.id === entry.id ? 1 : 0;
      const cur = lift.current.get(entry.id) ?? 0;
      if (cur !== want) {
        const next =
          Math.abs(want - cur) < 1e-4 ? want : cur + (want - cur) * catchUp;
        lift.current.set(entry.id, next);
        if (entry.fixed) entry.lift.scale.setScalar(1 + HOVER_SWELL * next);
        else entry.lift.position.y = HOVER_LIFT * next;
        if (next !== want) moving = true;
      }
      if (!entry.fixed) {
        // `fx` is written only while a hop or buzz runs, then put back once: the workstation owns
        // it the rest of the time (the mug on its way to the sitter's mouth).
        const b = bumpOffset(entry.id, now);
        if (b.active) {
          entry.fx.position.set(b.x, b.y, 0);
          bumping.current.add(entry.id);
          moving = true;
        } else if (bumping.current.delete(entry.id)) {
          entry.fx.position.set(0, 0, 0);
        }
      }
    }
    if (moving) invalidate();
  });

  useEffect(() => {
    const el = gl.domElement;
    const html = document.documentElement;
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    let press: Press | null = null;
    let swallowClick = false;
    let hoverRaf = 0;
    let hoverAt: { x: number; y: number } | null = null;
    let lastPointer = { x: 0, y: 0 };

    const canvasPoint = (cx: number, cy: number) => {
      const r = el.getBoundingClientRect();
      return { x: cx - r.left, y: cy - r.top, w: r.width, h: r.height };
    };

    /** The object under the pointer and the layer it is in. */
    const pick = (
      cx: number,
      cy: number,
    ): { id: string; layer: Layer; act: string } | null => {
      const free = fallBridge.api()?.pick(cx, cy);
      if (free) return { id: free, layer: 'fall', act: free };
      const p = canvasPoint(cx, cy);
      // Outside the table canvas there is nothing of the table to hit.
      if (p.w === 0 || p.x < 0 || p.y < 0 || p.x > p.w || p.y > p.h)
        return null;
      ndc.set((p.x / p.w) * 2 - 1, -(p.y / p.h) * 2 + 1);
      camera.updateMatrixWorld();
      raycaster.setFromCamera(ndc, camera);
      scene.updateMatrixWorld();
      const roots: Object3D[] = registry
        .pickable()
        .filter((x) => !x.free && x.obj.visible)
        .map((x) => x.obj);
      const hit = raycaster.intersectObjects(roots, true)[0];
      const id = hit ? entryIdOf(hit.object) : null;
      if (!id || !hit) return null;
      // the handset sits on the right front edge of the desk kit, the drawer on the left
      let act = id === 'drawer' && hit.point.x > 0.5 ? 'handset' : id;
      if (act === 'drawer') {
        // something that came out of the drawer (the card, the duck, the note...) has its own tap
        for (let n: Object3D | null = hit.object; n; n = n.parent) {
          const f: unknown = n.userData['find'];
          if (typeof f === 'string') {
            act = `find:${f}`;
            break;
          }
        }
      }
      return { id, layer: 'table', act };
    };

    /** The pointer on the table drag plane (x, z), or null when the ray misses it. */
    const toPlane = (
      cx: number,
      cy: number,
    ): { x: number; y: number } | null => {
      const p = canvasPoint(cx, cy);
      if (p.w === 0) return null;
      ndc.set((p.x / p.w) * 2 - 1, -(p.y / p.h) * 2 + 1);
      camera.updateMatrixWorld();
      raycaster.setFromCamera(ndc, camera);
      const { origin, direction } = raycaster.ray;
      const hit = planePoint(
        [origin.x, origin.y, origin.z],
        [direction.x, direction.y, direction.z],
        PLANE_Y,
      );
      return hit ? { x: hit.x, y: hit.z } : null;
    };

    const pointOf = (layer: Layer, cx: number, cy: number) =>
      layer === 'fall' ? { x: cx, y: cy } : toPlane(cx, cy);

    const setCursor = (c: string) => {
      html.style.cursor = c;
    };

    /** Furniture and anything a tap does more than scroll to is clicked, not grabbed. */
    // (the headphones are tapped, not grabbed, while a hand has them or they are worn)
    const isFixed = (id: string) => {
      const e = registry.get(id);
      return !!e && (e.fixed || e.obj.userData['locked'] === true);
    };
    const hoverCursor = (id: string) => (isFixed(id) ? 'pointer' : 'grab');

    const setHover = (id: string | null) => {
      if (hover.current.id === id) return;
      hover.current.id = id;
      setCursor(id ? hoverCursor(id) : '');
      invalidate();
    };

    /** A tap: the object reacts now; one with a section scrolls there a moment later. */
    const act = (id: string) => {
      reactions.fire(id);
      const target = registry.get(id)?.def.target;
      if (!target) return;
      window.setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent('nihal:navigate', { detail: target }),
        );
      }, NAVIGATE_DELAY_MS);
    };

    // The reset itself (everything home, with a tether for each thing out of place) is the
    // workstation's; this only drops the hover.
    const reset = () => setHover(null);

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
      setCursor(hover.current.id ? hoverCursor(hover.current.id) : '');
    };

    const tryGrab = () => {
      const p = press;
      if (!p || p.mode === 'grabbed' || isFixed(p.id)) return;
      const wants = p.touch ? p.mode === 'holding' : p.dragging;
      if (!wants) return;
      const ok =
        p.layer === 'fall'
          ? fallBridge.api()?.grab(p.id, p.last.x, p.last.y)
          : physicsBridge.api()?.grab(p.id, p.last.x, p.last.y);
      if (!ok) return;
      p.mode = 'grabbed';
      p.ring.clear();
      p.ring.push(p.last.x, p.last.y, performance.now());
      lastPointer = { x: p.x0, y: p.y0 };
      setCursor('grabbing');
      setHover(null);
      sendDrag(true);
      if (p.id === 'ghost' && p.layer === 'table')
        ghostLook.set({ x: p.last.x, z: p.last.y });
    };

    const finishGrab = (throwIt: boolean, now: number) => {
      const p = press;
      if (!p || p.mode !== 'grabbed') return;
      if (p.id === 'ghost') ghostLook.set(null);
      if (p.layer === 'fall') {
        const api = fallBridge.api();
        if (throwIt) {
          const v = p.ring.velocity(now, Infinity);
          api?.release(v.x, v.z, lastPointer.x, lastPointer.y);
        } else api?.drop();
      } else {
        const api = physicsBridge.api();
        if (throwIt) {
          const v = p.ring.velocity(now);
          api?.release(v.x, v.z);
        } else api?.drop();
      }
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
      const hit = pick(e.clientX, e.clientY);
      if (!hit) return;
      const { id, layer, act: actId } = hit;
      const start = pointOf(layer, e.clientX, e.clientY);
      if (!start) return;
      // A press is the gesture that lets a visitor who left sound on hear the desk.
      armSound();
      const touch = e.pointerType !== 'mouse';
      const p: Press = {
        id,
        act: actId,
        layer,
        pointerId: e.pointerId,
        touch,
        x0: e.clientX,
        y0: e.clientY,
        t0: e.timeStamp,
        mode: 'pending',
        dragging: false,
        timer: undefined,
        scrollY: window.scrollY,
        last: start,
        ring: new RingBuffer(),
        target: e.target instanceof Element ? e.target : null,
      };
      press = p;
      swallowClick = true;
      html.style.userSelect = 'none';
      if (isFixed(id)) {
        // Furniture is tapped, never grabbed: no engine request and no hold timer, so a swipe over
        // the chair still scrolls the page.
        if (!touch) {
          e.preventDefault();
          capture(e);
        }
      } else if (!touch) {
        e.preventDefault();
        if (layer === 'table') physicsBridge.request();
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
          if (layer === 'table') physicsBridge.request();
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
      setHover(pick(hoverAt.x, hoverAt.y)?.id ?? null);
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
      lastPointer = { x: e.clientX, y: e.clientY };
      const pt = pointOf(p.layer, e.clientX, e.clientY);
      if (pt) p.last = pt;
      if (!p.touch && !p.dragging && dist >= TAP_SLOP_PX) p.dragging = true;
      if (p.mode === 'grabbed') {
        if (!pt) return;
        p.ring.push(pt.x, pt.y, e.timeStamp);
        if (p.layer === 'fall') fallBridge.api()?.move(pt.x, pt.y);
        else physicsBridge.api()?.move(pt.x, pt.y);
        if (p.id === 'ghost' && p.layer === 'table')
          ghostLook.set({ x: pt.x, z: pt.y });
      } else tryGrab();
    };

    const onUp = (e: PointerEvent) => {
      const p = press;
      if (!p || e.pointerId !== p.pointerId) return;
      if (p.mode === 'grabbed') finishGrab(true, e.timeStamp);
      else {
        const dist = Math.hypot(e.clientX - p.x0, e.clientY - p.y0);
        if (isTap(dist, e.timeStamp - p.t0)) act(p.act);
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
      window.dispatchEvent(new CustomEvent(DESK_RESET_EVENT));
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
        // where it is drawn (a reaction or the tether moves `fx`, below `obj`)
        entry.lift.updateWorldMatrix(true, false);
        const o = entry.def.collider.offset;
        const p = new Vector3(o[0], o[1], o[2])
          .applyMatrix4(entry.lift.matrixWorld)
          .project(camera);
        const r = el.getBoundingClientRect();
        return {
          x: r.left + ((p.x + 1) / 2) * r.width,
          y: r.top + ((1 - p.y) / 2) * r.height,
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
      setInteractionProbe(null);
    };
  }, [gl, camera, scene, invalidate]);

  return null;
}
