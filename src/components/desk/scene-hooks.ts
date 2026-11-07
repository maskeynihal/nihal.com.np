import type { PerspectiveCamera, WebGLRenderer } from 'three';
import { testHooks } from '../../lib/env';
import { oledText } from '../../lib/desk/oled';
import { fallBridge, physicsBridge, testControl } from './physics-bridge';
import { audioProbe } from '../../lib/sound';

/** What the Scene exposes to e2e (`PUBLIC_TEST_HOOKS=1`). Everything that touches three lives here. */
export interface SceneProbe {
  frames: number;
  fallFrames: number;
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
  callouts: () => {
    id: string;
    text: string;
    active: boolean;
    lineOpacity: number;
  }[];
  /** The scroll springs (D3): shift in metres and speed per object that has one. */
  motion: () => { id: string; x: number; v: number }[];
  /** The live renderer, for context and memory hooks. */
  gl: WebGLRenderer | null;
  /** While true the 1 s / 500 ms timers keep running but stop requesting frames (tests only). */
  quiet: boolean;
}

export const probe: SceneProbe = {
  frames: 0,
  fallFrames: 0,
  camera: null,
  oled: { ticks: 0, text: () => '' },
  clocks: new Map(),
  calendar: { face: () => null },
  ghost: { look: () => {}, release: () => {}, eyes: () => [] },
  size: () => ({ width: 0, height: 0 }),
  probeSphere: () => null,
  interaction: { pick: () => null, hovered: () => null, lift: () => 0 },
  callouts: () => [],
  motion: () => [],
  gl: null,
  quiet: false,
};

/** True when a test asked for the idle timers to stay off the frame counter. Always false in a plain build. */
export const isQuiet = (): boolean => testHooks && probe.quiet;

let loseExt: WEBGL_lose_context | null | undefined;

/** Merges the probe into `__hooks.desk.scene`. A plain build drops this (testHooks is a constant). */
export function installSceneHooks(): () => void {
  if (!testHooks) return () => {};
  const hooks = window.__hooks;
  if (!hooks) return () => {};
  const desk = (hooks.desk ??= {
    fail() {},
    state: () => '',
    disposed: () => null,
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
    fall: () => ({
      state: fallBridge.state(),
      grabbed: fallBridge.api()?.grabbed() ?? null,
      frames: probe.fallFrames,
      bodies: fallBridge.api()?.bodies() ?? [],
    }),
    handoffs: () => physicsBridge.api()?.handoffs() ?? [],
    hold: (on) => {
      testControl.hold = on;
      physicsBridge.api()?.hold(on);
      fallBridge.api()?.hold(on);
    },
    stepWorlds: (n) => {
      physicsBridge.api()?.step(n);
      fallBridge.api()?.step(n);
    },
    requestPhysics: () => physicsBridge.request(),
    teleport: (id, x, y, z, v) =>
      physicsBridge.api()?.teleport(id, x, y, z, v) ?? false,
    pick: (id) => probe.interaction.pick(id),
    hovered: () => probe.interaction.hovered(),
    hoverLift: (id) => probe.interaction.lift(id),
    callouts: () => probe.callouts(),
    motion: () => probe.motion(),
    audio: () => audioProbe(),
    memory: () => {
      const m = probe.gl?.info.memory;
      return m ? { geometries: m.geometries, textures: m.textures } : null;
    },
    loseContext: () => {
      // A lost context no longer hands the extension out, so keep it for restoreContext.
      loseExt = probe.gl?.getContext().getExtension('WEBGL_lose_context');
      loseExt?.loseContext();
    },
    restoreContext: () => loseExt?.restoreContext(),
    contextLost: () => probe.gl?.getContext().isContextLost() ?? false,
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
export function setGlProbe(gl: WebGLRenderer | null): void {
  probe.gl = gl;
}
export function countFallFrame(): void {
  probe.fallFrames += 1;
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
export function setMotionProbe(fn: SceneProbe['motion'] | null): void {
  probe.motion = fn ?? (() => []);
}
