import type { PerspectiveCamera } from 'three';
import { testHooks } from '../../lib/env';
import { oledText } from '../../lib/desk/oled';

/** What the Scene exposes to e2e (`PUBLIC_TEST_HOOKS=1`). Everything that touches three lives here. */
interface SceneProbe {
  frames: number;
  camera: PerspectiveCamera | null;
  oled: { ticks: number; text: () => string };
  size: () => { width: number; height: number };
  probeSphere: (on: boolean) => { cx: number; cy: number; r: number } | null;
}

const probe: SceneProbe = {
  frames: 0,
  camera: null,
  oled: { ticks: 0, text: () => '' },
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
    oledTicks: () => probe.oled.ticks,
    oledText: () => probe.oled.text(),
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
export function setOledProbe(tick: () => number): void {
  probe.oled.text = () => {
    const t = oledText(tick());
    return `${t.label} ${t.value}`;
  };
}
export function countOledTick(): void {
  probe.oled.ticks += 1;
}
