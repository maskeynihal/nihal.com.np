import type { PerspectiveCamera } from 'three';
import { testHooks } from '../../lib/env';
import { oledText } from '../../lib/desk/oled';
import { physicsBridge } from './physics-bridge';
import { audioProbe } from '../../lib/sound';

/** What the Scene exposes to e2e (`PUBLIC_TEST_HOOKS=1`). Everything that touches three lives here. */
export interface SceneProbe {
  frames: number;
  camera: PerspectiveCamera | null;
  oled: { ticks: number; text: () => string };
  clocks: Map<string, { hour: () => number; minute: () => number }>;
  calendar: { face: () => unknown };
  ghost: {
    look: (x: number, z: number) => void;
    release: () => void;
    eyes: () => number[];
  };
  size: () => { width: number; height: number };
  probeSphere: (on: boolean) => { cx: number; cy: number; r: number } | null;
  /** Set by Interaction. */
  interaction: {
    pick: (id: string) => { x: number; y: number } | null;
    hovered: () => string | null;
    lift: (id: string) => number;
  };
  explode: {
    state: () => { target: number; factor: number; range: number };
    offset: (id: string) => [number, number, number];
    leaders: () => { id: string; visible: boolean; opacity: number }[];
  };
  callouts: () => {
    id: string;
    text: string;
    active: boolean;
    lineOpacity: number;
  }[];
  /** While true the 1 s / 500 ms timers keep running but stop requesting frames (tests only). */
  quiet: boolean;
}

export const probe: SceneProbe = {
  frames: 0,
  camera: null,
  oled: { ticks: 0, text: () => '' },
  clocks: new Map(),
  calendar: { face: () => null },
  ghost: { look: () => {}, release: () => {}, eyes: () => [] },
  size: () => ({ width: 0, height: 0 }),
  probeSphere: () => null,
  interaction: { pick: () => null, hovered: () => null, lift: () => 0 },
  explode: {
    state: () => ({ target: 0, factor: 0, range: 1 }),
    offset: () => [0, 0, 0],
    leaders: () => [],
  },
  callouts: () => [],
  quiet: false,
};

/** True when a test asked for the idle timers to stay off the frame counter. Always false in a plain build. */
export const isQuiet = (): boolean => testHooks && probe.quiet;

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
    clocks: () =>
      [...probe.clocks].map(([id, c]) => ({
        id,
        hour: c.hour(),
        minute: c.minute(),
      })),
    calendar: () => probe.calendar.face(),
    ghostLook: (x, z) => probe.ghost.look(x, z),
    ghostRelease: () => probe.ghost.release(),
    ghostEyes: () => probe.ghost.eyes(),
    size: () => probe.size(),
    probeSphere: (on) => probe.probeSphere(on),
    physics: () => ({
      state: physicsBridge.state(),
      grabbed: physicsBridge.api()?.grabbed() ?? null,
      bodies: physicsBridge.api()?.bodies() ?? [],
    }),
    requestPhysics: () => physicsBridge.request(),
    teleport: (id, x, y, z) =>
      physicsBridge.api()?.teleport(id, x, y, z) ?? false,
    pick: (id) => probe.interaction.pick(id),
    hovered: () => probe.interaction.hovered(),
    hoverLift: (id) => probe.interaction.lift(id),
    explode: () => probe.explode.state(),
    explodeOffset: (id) => probe.explode.offset(id),
    explodeLeaders: () => probe.explode.leaders(),
    callouts: () => probe.callouts(),
    audio: () => audioProbe(),
    quiet: (on) => {
      probe.quiet = on;
    },
  };
  return () => {
    delete desk.scene;
  };
}

// Plain helpers so components never assign into the shared probe object themselves.
export function setOledProbe(tick: () => number): void {
  probe.oled.text = () => {
    const t = oledText(tick());
    return `${t.label} ${t.value}`;
  };
}
export function countOledTick(): void {
  probe.oled.ticks += 1;
}
export function setCalendarProbe(face: unknown): void {
  probe.calendar.face = () => face ?? null;
}
export function setClockProbe(
  id: string,
  hands: { hour: () => number; minute: () => number } | null,
): void {
  if (hands) probe.clocks.set(id, hands);
  else probe.clocks.delete(id);
}
export function setGhostProbe(g: SceneProbe['ghost']): void {
  probe.ghost = g;
}
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
export function setInteractionProbe(i: SceneProbe['interaction'] | null): void {
  probe.interaction = i ?? {
    pick: () => null,
    hovered: () => null,
    lift: () => 0,
  };
}
export function setCalloutProbe(fn: SceneProbe['callouts'] | null): void {
  probe.callouts = fn ?? (() => []);
}
export function setExplodeProbe(e: SceneProbe['explode'] | null): void {
  probe.explode = e ?? {
    state: () => ({ target: 0, factor: 0, range: 1 }),
    offset: () => [0, 0, 0],
    leaders: () => [],
  };
}
