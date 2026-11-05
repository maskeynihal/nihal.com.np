import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Vector3, type Camera } from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import type { InterleavedBufferAttribute } from 'three';
import { getMotion } from '../../lib/prefs';
import {
  ACTIVE_OPACITY,
  LEADER_LENGTH,
  REST_OPACITY,
  fadeAt,
  fadeMs,
  keepInside,
  labelPlacement,
  leaderDirection,
} from '../../lib/desk/callouts';
import { activity } from './activity';
import { useLineArt } from './scene-context';
import { registry } from './registry';
import { setCalloutProbe } from './scene-hooks';

interface Item {
  id: string;
  anchor: Vector3;
  dir: { x: number; z: number };
  tx: '0' | '-50%' | '-100%';
  ty: '0' | '-50%' | '-100%';
  line: LineSegments2;
  material: LineMaterial;
  el: HTMLElement;
  active: boolean;
  fade: { from: number; to: number; t0: number; ms: number; value: number };
  /** Last end points written, to skip identical updates. */
  key: string;
}

const _a = new Vector3();
const _b = new Vector3();

/** Moves every leader line and label to its object's current pose; true while a fade runs. */
function updateCallouts(
  items: readonly Item[],
  camera: Camera,
  size: { width: number; height: number },
): boolean {
  const now = performance.now();
  let moving = false;
  for (const it of items) {
    const entry = registry.get(it.id);
    if (!entry) continue;
    entry.obj.updateWorldMatrix(true, false);
    _a.copy(it.anchor).applyMatrix4(entry.obj.matrixWorld);
    _b.set(
      _a.x + it.dir.x * LEADER_LENGTH,
      _a.y,
      _a.z + it.dir.z * LEADER_LENGTH,
    );
    const key = `${_a.x.toFixed(4)},${_a.y.toFixed(4)},${_a.z.toFixed(4)}`;
    if (key !== it.key) {
      it.key = key;
      const attr = it.line.geometry.getAttribute(
        'instanceStart',
      ) as InterleavedBufferAttribute;
      (attr.data.array as Float32Array).set([
        _a.x,
        _a.y,
        _a.z,
        _b.x,
        _b.y,
        _b.z,
      ]);
      attr.data.needsUpdate = true;
    }
    it.material.resolution.set(size.width, size.height);
    const f = it.fade;
    f.value = fadeAt(f.from, f.to, now - f.t0, f.ms);
    it.material.opacity = f.value;
    if (f.value !== f.to) moving = true;
    // The label sits at the far end of the leader, in canvas CSS px.
    _b.project(camera);
    const x = keepInside(
      ((_b.x + 1) / 2) * size.width,
      it.tx,
      it.el.offsetWidth,
      size.width,
    );
    const y = keepInside(
      ((1 - _b.y) / 2) * size.height,
      it.ty,
      it.el.offsetHeight,
      size.height,
    );
    it.el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) translate(${it.tx}, ${it.ty})`;
  }
  return moving;
}

/**
 * Dimension callouts (design 4.3): for every shown object, a leader line from an anchor on the
 * object out to a DOM label (`role="tooltip"`, text from `objects.ts`). Labels and lines rest at
 * 0.5 opacity so a screenshot reads, and go to 1.0 while their object is hovered or held
 * (160 ms in, 240 ms out; none under reduced motion). The lines are `LineSegments2` in the
 * secondary line colour; the labels are DOM nodes in a layer on top of the canvas, moved with
 * the objects on every drawn frame, so they cost nothing while the desk is still.
 */
export function Callouts() {
  const { gl, scene, invalidate } = useThree();
  const art = useLineArt();
  const itemsRef = useRef<Item[]>([]);

  useEffect(() => {
    const host = gl.domElement.parentElement;
    if (!host) return;
    const layer = document.createElement('div');
    layer.className = 'desk-callouts';
    host.appendChild(layer);
    const group = new Group();
    group.name = 'callouts';
    scene.add(group);
    const items = itemsRef.current;

    const clear = () => {
      for (const it of items) {
        group.remove(it.line);
        it.line.geometry.dispose();
        it.material.dispose();
        it.el.remove();
      }
      items.length = 0;
    };

    const build = () => {
      clear();
      for (const entry of registry.all()) {
        for (const c of entry.def.callouts) {
          const material = art.lineSecondary.clone();
          material.transparent = true;
          material.alphaToCoverage = false;
          material.depthTest = false;
          material.opacity = REST_OPACITY;
          const line = new LineSegments2(
            new LineSegmentsGeometry().setPositions([0, 0, 0, 0, 0, 0]),
            material,
          );
          line.name = `callout-${entry.id}`;
          line.frustumCulled = false;
          line.renderOrder = 5;
          line.raycast = () => {};
          group.add(line);
          const el = document.createElement('div');
          el.className = 'label desk-callout';
          el.setAttribute('role', 'tooltip');
          el.dataset['callout'] = entry.id;
          el.dataset['active'] = 'false';
          el.textContent = c.text;
          layer.appendChild(el);
          const dir = leaderDirection(c.anchor);
          const place = labelPlacement(dir);
          items.push({
            id: entry.id,
            anchor: new Vector3(...c.anchor),
            dir,
            tx: place.tx,
            ty: place.ty,
            line,
            material,
            el,
            active: false,
            fade: {
              from: REST_OPACITY,
              to: REST_OPACITY,
              t0: 0,
              ms: 0,
              value: REST_OPACITY,
            },
            key: '',
          });
        }
      }
      sync(false);
      invalidate();
    };

    // The object that should read as active changed: start the fades, and let the DOM
    // labels' own CSS transition run (they do not wait for a frame).
    const sync = (animate: boolean) => {
      const current = activity.active();
      const full = getMotion() === 'full';
      const now = performance.now();
      for (const it of items) {
        const want = it.id === current;
        if (want === it.active) continue;
        it.active = want;
        it.el.dataset['active'] = String(want);
        it.fade = {
          from: it.fade.value,
          to: want ? ACTIVE_OPACITY : REST_OPACITY,
          t0: now,
          ms: animate ? fadeMs(want, full) : 0,
          value: it.fade.value,
        };
      }
    };
    const onActivity = () => {
      sync(true);
      invalidate();
    };

    build();
    const offRegistry = registry.subscribe(build);
    const offActivity = activity.subscribe(onActivity);
    setCalloutProbe(() =>
      items.map((it) => ({
        id: it.id,
        text: it.el.textContent ?? '',
        active: it.active,
        lineOpacity: it.fade.value,
      })),
    );
    return () => {
      offRegistry();
      offActivity();
      setCalloutProbe(null);
      clear();
      scene.remove(group);
      layer.remove();
    };
  }, [gl, scene, art, invalidate]);

  useFrame((state) => {
    if (updateCallouts(itemsRef.current, state.camera, state.size))
      invalidate();
  });
  return null;
}
