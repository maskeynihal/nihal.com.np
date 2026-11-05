import type { PerspectiveCamera } from 'three';
import { testHooks } from '../../lib/env';

/** What the Scene exposes to e2e (`PUBLIC_TEST_HOOKS=1`). Everything that touches three lives here. */
interface SceneProbe {
  frames: number;
  camera: PerspectiveCamera | null;
  size: () => { width: number; height: number };
  probeSphere: (on: boolean) => { cx: number; cy: number; r: number } | null;
}

const probe: SceneProbe = {
  frames: 0,
  camera: null,
  size: () => ({ width: 0, height: 0 }),
  probeSphere: () => null,
};

/** Merges the probe into `__hooks.desk.scene`. A plain build drops this (testHooks is a constant). */
export function installSceneHooks(): () => void {
  if (!testHooks) return () => {};
  const hooks = window.__hooks;
  if (!hooks) return () => {};
  const desk = (hooks.desk ??= {
    fail() {},
    state: () => '',
  });
  desk.scene = {
    frames: () => probe.frames,
    size: () => probe.size(),
    probeSphere: (on) => probe.probeSphere(on),
  };
  return () => {
    delete desk.scene;
  };
}

// Plain helpers so components never assign into the shared probe object themselves.
export function countFrame(): void {
  probe.frames += 1;
}
export function setCameraProbe(
  camera: PerspectiveCamera,
  size: { width: number; height: number },
): void {
  probe.camera = camera;
  probe.size = () => ({ width: size.width, height: size.height });
}
export function getProbeCamera(): PerspectiveCamera | null {
  return probe.camera;
}
export function setSphereProbe(fn: SceneProbe['probeSphere']): void {
  probe.probeSphere = fn;
}
