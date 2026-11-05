import {
  Suspense,
  lazy,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import {
  SphereGeometry,
  Vector3,
  type Group,
  type PerspectiveCamera,
  type Material,
  type Object3D,
} from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { dprFor, getMotion, subscribeMotion } from '../../lib/prefs';
import { testHooks } from '../../lib/env';
import { cameraFor, type CameraPose } from '../../lib/desk/camera';
import { handAngles, clockZone, pivotY } from '../../lib/desk/clock';
import { calendarFace } from '../../lib/desk/calendar';
import { eyeYaw } from '../../lib/desk/eyes';
import { ghostLook } from '../../lib/desk/ghost-look';
import { OLED_TICK_MS } from '../../lib/desk/oled';
import { playTick } from '../../lib/sound';
import { parseObjects, type ObjectDef } from '../../lib/desk/object-def';
import { readToken } from '../../lib/desk/tokens';
import holidays from '../../content/holidays.json';
import type { Holiday } from '../../content/schema';
import {
  createLineArt,
  prepareLineArt,
  sphereProbe,
  type LineArt,
} from './line-art';
import { resolveModelUrls } from './models';
import {
  ActiveContext,
  LineArtContext,
  useActive,
  useLineArt,
} from './scene-context';
import {
  countFrame,
  countOledTick,
  getProbeCamera,
  installSceneHooks,
  isQuiet,
  setCalendarProbe,
  setCameraProbe,
  setClockProbe,
  setGhostProbe,
  setOledProbe,
  setSphereProbe,
} from './scene-hooks';
import { Callouts } from './Callouts';
import { Explode } from './Explode';
import { Interaction } from './Interaction';
import { IslandBoundary } from './IslandBoundary';
import { physicsBridge } from './physics-bridge';
import { registry } from './registry';
import { createCalendarTexture, createOledTexture } from './textures';

// R3F 9.8 builds a `THREE.Clock` for each root, and three 0.187 warns (console.warn) on every one.
// Drop only that notice from module load until the canvas exists, so the page console stays clean.
// Remove with the next R3F that uses THREE.Timer.
const clockNotice = /^THREE\.Clock: This module has been deprecated/;
const nativeWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (typeof args[0] === 'string' && clockNotice.test(args[0])) return;
  nativeWarn.apply(console, args);
};
const restoreWarn = () => {
  if (console.warn !== nativeWarn) console.warn = nativeWarn;
};
setTimeout(restoreWarn, 10_000);

/**
 * The 3D desk (loaded lazily by DeskShell; never imported statically, `pnpm check:graph`).
 * Lines, not light: blue occluders, white inverted-hull outlines and authored creases.
 * `frameloop="demand"`: anything that changes a pixel calls `invalidate()`.
 */

/** The shown objects, written into the HTML by Poster.astro (Scene never imports objects.ts). */
function readObjects(): ObjectDef[] {
  return parseObjects(
    document.querySelector('[data-poster]')?.getAttribute('data-objects'),
  );
}

/** The sheet is drawn like an object but is never registered, picked or given a body. */
const SHEET_DEF: ObjectDef = {
  id: 'sheet',
  model: 'sheet',
  p: [0, 0, 0],
  q: [0, 0, 0, 1],
  collider: { kind: 'cuboid', args: [0.8, 0.01, 0.6], offset: [0, 0, 0] },
  mass: 1,
  callouts: [],
  target: '#desk',
  explode: [0, 0, 0],
};

// The physics layer is its own chunk: requested on the first grab, never with the Scene.
const PhysicsWorld = lazy(() => import('./physics/physics-world'));

function applyPose(cam: PerspectiveCamera, pose: CameraPose): void {
  cam.fov = pose.fov;
  cam.near = pose.near;
  cam.far = pose.far;
  cam.position.set(...pose.position);
  cam.lookAt(...pose.lookAt);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
}

// ---- visibility -------------------------------------------------------------------------

/** On screen (within one viewport) and the tab is showing. Pauses the loop and every timer. */
function useActiveState(host: React.RefObject<HTMLElement | null>): boolean {
  const [near, setNear] = useState(true);
  const [shown, setShown] = useState(
    typeof document === 'undefined' ? true : !document.hidden,
  );
  useEffect(() => {
    const onVis = () => setShown(!document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);
  useEffect(() => {
    const el = host.current;
    if (!el || typeof IntersectionObserver !== 'function') return;
    const io = new IntersectionObserver(
      (entries) => setNear(entries.some((e) => e.isIntersecting)),
      { rootMargin: '100%' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [host]);
  return near && shown;
}

function useMotionFull(): boolean {
  const [full, setFull] = useState(() => getMotion() === 'full');
  useEffect(() => subscribeMotion((m) => setFull(m === 'full')), []);
  return full;
}

// ---- camera, resolution, ready ------------------------------------------------------------

function Rig({ art }: { art: LineArt }) {
  const { camera, size, invalidate, gl } = useThree();
  useLayoutEffect(() => {
    applyPose(camera as PerspectiveCamera, cameraFor(window.innerWidth));
    art.setResolution(size.width, size.height);
    setCameraProbe(camera as PerspectiveCamera, size);
    invalidate();
  }, [camera, size, art, invalidate]);
  useEffect(() => {
    gl.domElement.setAttribute('aria-hidden', 'true');
  }, [gl]);
  return null;
}

/**
 * Puts the "demo values" caption under the Arduino's screen, in canvas CSS px. It follows the
 * board: recomputed on every frame that is drawn (a grab, a throw or a resize each draw one).
 */
function OledCaption({ target }: { target: React.RefObject<Object3D | null> }) {
  const { camera, size, gl } = useThree();
  const caption = useRef<HTMLElement | null>(null);
  const last = useRef('');
  useLayoutEffect(() => {
    caption.current =
      gl.domElement
        .closest('[data-desk]')
        ?.querySelector<HTMLElement>('[data-oled-caption]') ?? null;
    const el = caption.current;
    return () => {
      if (el) el.style.transform = '';
      last.current = '';
    };
  }, [gl]);
  const at = useMemo(() => new Vector3(), []);
  const place = () => {
    const node = target.current;
    const el = caption.current;
    if (!node || !el) return;
    camera.updateMatrixWorld();
    node.updateWorldMatrix(true, false);
    // Just in front of the board's lower edge, below the screen.
    node.getWorldPosition(at).add(new Vector3(0, -0.05, 0.1));
    at.project(camera);
    const x = ((at.x + 1) / 2) * size.width;
    const y = ((1 - at.y) / 2) * size.height;
    const t = `translate(${Math.round(x - el.offsetWidth / 2)}px, ${Math.round(y) + 4}px)`;
    if (t === last.current) return;
    last.current = t;
    el.style.transform = t;
  };
  useLayoutEffect(place);
  useFrame(place);
  return null;
}

/** Calls `onReady` once, after the first frame with every model in it has been drawn. */
function Ready({ onReady }: { onReady: () => void }) {
  const { invalidate } = useThree();
  const done = useRef(false);
  useEffect(() => invalidate(), [invalidate]);
  useFrame(() => {
    if (done.current) return;
    done.current = true;
    // useFrame runs before the renderer draws in the same tick; a timeout lands after it.
    setTimeout(onReady, 0);
  });
  return null;
}

function FrameCounter() {
  useFrame(() => {
    countFrame();
  });
  return null;
}

// ---- models ---------------------------------------------------------------------------------

function useGltf(url: string) {
  return useLoader(GLTFLoader, url, (loader) => {
    loader.setMeshoptDecoder(MeshoptDecoder);
  });
}

/** A cloned, line-art-ified model placed at its home pose. `children` get the model root. */
function Model({
  url,
  def,
  textured,
  sheet,
  onRoot,
  children,
}: {
  url: string;
  def: ObjectDef;
  textured?: Record<string, Material>;
  sheet?: boolean;
  onRoot?: (root: Object3D) => void;
  children?: (root: Object3D) => ReactNode;
}) {
  const art = useLineArt();
  const gltf = useGltf(url);
  const group = useRef<Group>(null);
  const root = useMemo(() => {
    const clone = gltf.scene.clone(true);
    prepareLineArt(clone, art, { textured, sheet: sheet ?? false });
    return clone;
  }, [gltf, art, textured, sheet]);
  useLayoutEffect(() => onRoot?.(root), [root, onRoot]);
  // Every object (not the sheet) goes in the registry: picking, physics and explode read it.
  useLayoutEffect(() => {
    const obj = group.current;
    if (sheet || !obj) return;
    return registry.register({ id: def.id, def, obj, lift: root });
  }, [def, root, sheet]);
  return (
    <group
      ref={group}
      name={def.id}
      userData={sheet ? {} : { deskId: def.id }}
      position={def.p}
      quaternion={def.q}
    >
      <primitive object={root} />
      {children?.(root)}
    </group>
  );
}

// ---- OLED -----------------------------------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', '').slice(0, 6), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function useOled() {
  const { invalidate } = useThree();
  const active = useActive();
  const motion = useMotionFull();
  const tick = useRef(0);
  const oled = useMemo(
    () =>
      createOledTexture({
        background: hexToRgb(readToken('--blue-ink')),
        ink: hexToRgb(readToken('--white')),
      }),
    [],
  );

  useEffect(() => {
    oled.draw(tick.current);
    invalidate();
    setOledProbe(() => tick.current);
  }, [oled, invalidate]);

  // 500 ms, only while the desk is on screen, the tab shows and motion is allowed.
  useEffect(() => {
    if (!active || !motion) return;
    const id = setInterval(() => {
      tick.current += 1;
      countOledTick();
      oled.draw(tick.current);
      if (!isQuiet()) invalidate();
    }, OLED_TICK_MS);
    return () => clearInterval(id);
  }, [active, motion, oled, invalidate]);

  useEffect(() => () => oled.dispose(), [oled]);
  return oled.material;
}

// ---- clocks -----------------------------------------------------------------------------------

function ClockHands({ id, root }: { id: string; root: Object3D }) {
  const { invalidate } = useThree();
  const active = useActive();
  useEffect(() => {
    const hour = root.getObjectByName('hand-hour');
    const minute = root.getObjectByName('hand-minute');
    if (!hour || !minute) return;
    setClockProbe(id, {
      hour: () => -hour.rotation.y,
      minute: () => -minute.rotation.y,
    });
    return () => setClockProbe(id, null);
  }, [id, root]);
  useEffect(() => {
    const hour = root.getObjectByName('hand-hour');
    const minute = root.getObjectByName('hand-minute');
    if (!hour || !minute) return;
    let minuteSeen: number | null = null;
    const set = () => {
      const a = handAngles(new Date(), clockZone(id));
      // Tick when the minute hand moves, not on the first reading.
      if (minuteSeen !== null && minuteSeen !== a.minute) playTick();
      minuteSeen = a.minute;
      const h = pivotY(a.hour);
      const m = pivotY(a.minute);
      if (hour.rotation.y !== h || minute.rotation.y !== m) {
        hour.rotation.y = h;
        minute.rotation.y = m;
        if (!isQuiet()) invalidate();
      }
    };
    set();
    if (!active) return;
    const timer = setInterval(set, 1000);
    return () => clearInterval(timer);
  }, [id, root, active, invalidate]);
  return null;
}

// ---- calendar ---------------------------------------------------------------------------------

function useCalendarMaterial() {
  const { invalidate } = useThree();
  const active = useActive();
  const calendar = useMemo(
    () => createCalendarTexture(readToken('--paper'), readToken('--blue-ink')),
    [],
  );

  useEffect(() => {
    let last = '';
    const refresh = (force = false) => {
      const face = calendarFace(new Date(), holidays as Holiday[]);
      setCalendarProbe(face);
      const key = JSON.stringify(face ?? null);
      if (!force && key === last) return;
      last = key;
      calendar.draw(face);
      if (!isQuiet()) invalidate();
    };
    refresh(true);
    // Web fonts may land after the first draw.
    void document.fonts?.ready.then(() => refresh(true));
    if (!active) return;
    const timer = setInterval(refresh, 1000);
    return () => clearInterval(timer);
  }, [calendar, active, invalidate]);

  useEffect(() => () => calendar.dispose(), [calendar]);
  return calendar.material;
}

// ---- ghost ------------------------------------------------------------------------------------

/** Eyes follow `ghostLook` (set by the grab in E-05); forward when it is null. No idle following. */
function GhostEyes({ root }: { root: Object3D }) {
  const { invalidate } = useThree();
  useEffect(() => {
    const eyes = ['eye-l', 'eye-r']
      .map((n) => root.getObjectByName(n))
      .filter((e): e is Object3D => !!e);
    const apply = () => {
      const target = ghostLook.get();
      const at = new Vector3();
      for (const eye of eyes) {
        eye.rotation.y = target
          ? (eye.getWorldPosition(at), eyeYaw(at.x, at.z, target.x, target.z))
          : 0;
      }
      invalidate();
    };
    setGhostProbe({
      look: (x, z) => ghostLook.set({ x, z }),
      release: () => ghostLook.set(null),
      eyes: () => eyes.map((e) => e.rotation.y),
    });
    apply();
    return ghostLook.subscribe(apply);
  }, [root, invalidate]);
  return null;
}

// ---- the desk ---------------------------------------------------------------------------------

function ObjectNode({
  def,
  url,
  captionTargetRef,
}: {
  def: ObjectDef;
  url: string;
  captionTargetRef: React.RefObject<Object3D | null>;
}) {
  if (def.model === 'arduino')
    return <Arduino def={def} url={url} captionTargetRef={captionTargetRef} />;
  if (def.model === 'calendar') return <Calendar def={def} url={url} />;
  if (def.model === 'clock')
    return (
      <Model url={url} def={def}>
        {(root) => <ClockHands id={def.id} root={root} />}
      </Model>
    );
  if (def.model === 'ghost')
    return (
      <Model url={url} def={def}>
        {(root) => <GhostEyes root={root} />}
      </Model>
    );
  return <Model url={url} def={def} />;
}

function Arduino({
  def,
  url,
  captionTargetRef,
}: {
  def: ObjectDef;
  url: string;
  captionTargetRef: React.RefObject<Object3D | null>;
}) {
  const material = useOled();
  const textured = useMemo(() => ({ 'screen-mesh': material }), [material]);
  return (
    <Model
      url={url}
      def={def}
      textured={textured}
      onRoot={(root) => {
        captionTargetRef.current = root.getObjectByName('screen') ?? null;
      }}
    />
  );
}

function Calendar({ def, url }: { def: ObjectDef; url: string }) {
  const material = useCalendarMaterial();
  const textured = useMemo(() => ({ 'face-mesh': material }), [material]);
  return <Model url={url} def={def} textured={textured} />;
}

function Desk({
  objects,
  urls,
  probeOn,
  onReady,
}: {
  objects: ObjectDef[];
  urls: Record<string, string>;
  probeOn: boolean;
  onReady: () => void;
}) {
  const captionTargetRef = useRef<Object3D | null>(null);
  const sheetUrl = urls['sheet'];
  return (
    <>
      <group visible={!probeOn}>
        {sheetUrl ? <Model url={sheetUrl} def={SHEET_DEF} sheet /> : null}
        {objects.map((def) => {
          const url = urls[def.model];
          return url ? (
            <ObjectNode
              key={def.id}
              def={def}
              url={url}
              captionTargetRef={captionTargetRef}
            />
          ) : null;
        })}
      </group>
      <OledCaption target={captionTargetRef} />
      <Ready onReady={onReady} />
    </>
  );
}

/** Test aid: one big sphere to check the silhouette pass on a curved surface. */
function SphereProbe({ on }: { on: boolean }) {
  const art = useLineArt();
  const geometry = useMemo(() => new SphereGeometry(0.2, 48, 32), []);
  const group = useMemo<Group>(
    () => sphereProbe(art, geometry),
    [art, geometry],
  );
  useEffect(() => () => geometry.dispose(), [geometry]);
  return on ? <primitive object={group} position={[0, 0.2, 0]} /> : null;
}

export default function Scene({ onReady }: { onReady: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const active = useActiveState(hostRef);
  const art = useMemo(() => createLineArt(), []);
  const objects = useMemo(() => readObjects(), []);
  const [urls, setUrls] = useState<Record<string, string> | null>(null);
  const [probeOn, setProbeOn] = useState(false);
  const [physicsOn, setPhysicsOn] = useState(false);

  useEffect(() => () => art.dispose(), [art]);

  // The engine is requested by the first grab (Interaction), never earlier. A fresh Scene starts
  // from a clean bridge; physics follows `loading`, and a failed load leaves taps working.
  useEffect(() => {
    physicsBridge.reset();
    const sync = () => setPhysicsOn(physicsBridge.state() !== 'idle');
    const off = physicsBridge.subscribe(sync);
    return () => {
      off();
      physicsBridge.reset();
    };
  }, []);

  useEffect(() => {
    let live = true;
    void resolveModelUrls(['sheet', ...objects.map((o) => o.model)]).then(
      (u) => live && setUrls(u),
    );
    return () => {
      live = false;
    };
  }, [objects]);

  useEffect(() => installSceneHooks(), []);
  useEffect(() => {
    if (!testHooks) return;
    setSphereProbe((on) => {
      setProbeOn(on);
      const cam = getProbeCamera();
      const el = hostRef.current?.querySelector('canvas');
      if (!on || !cam || !el) return null;
      // Sphere centre (0, 0.2, 0), radius 0.2 m, through the Rig's camera.
      cam.updateMatrixWorld();
      const w = el.clientWidth;
      const h = el.clientHeight;
      const toPx = (v: Vector3) => {
        v.project(cam);
        return { x: ((v.x + 1) / 2) * w, y: ((1 - v.y) / 2) * h };
      };
      const c = toPx(new Vector3(0, 0.2, 0));
      // A point one radius to the camera's right is on the silhouette's horizontal extreme.
      const right = new Vector3().setFromMatrixColumn(cam.matrixWorld, 0);
      const e = toPx(new Vector3(0, 0.2, 0).addScaledVector(right, 0.2));
      return { cx: c.x, cy: c.y, r: Math.abs(e.x - c.x) };
    });
  }, []);

  return (
    <div ref={hostRef} style={{ width: '100%', height: '100%' }}>
      <ActiveContext.Provider value={active}>
        <LineArtContext.Provider value={art}>
          <Canvas
            frameloop={active ? 'demand' : 'never'}
            flat
            dpr={dprFor()}
            gl={{
              alpha: false,
              antialias: true,
              powerPreference: 'low-power',
              depth: true,
            }}
            camera={{ fov: 35, near: 0.5, far: 8 }}
            resize={{ debounce: 200, scroll: false }}
            onCreated={({ gl }) => {
              restoreWarn();
              gl.setClearColor(art.blue, 1);
            }}
          >
            <Rig art={art} />
            <Explode />
            <Interaction />
            <Callouts />
            {physicsOn ? (
              <IslandBoundary
                island="physics"
                fallback={() => null}
                onError={() => physicsBridge.fail()}
              >
                <Suspense fallback={null}>
                  <PhysicsWorld paused={!active} />
                </Suspense>
              </IslandBoundary>
            ) : null}
            <Suspense fallback={null}>
              {urls ? (
                <Desk
                  objects={objects}
                  urls={urls}
                  probeOn={probeOn}
                  onReady={onReady}
                />
              ) : null}
              <SphereProbe on={probeOn} />
            </Suspense>
            {testHooks ? <FrameCounter /> : null}
          </Canvas>
        </LineArtContext.Provider>
      </ActiveContext.Provider>
    </div>
  );
}
