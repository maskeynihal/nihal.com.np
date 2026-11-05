import {
  Suspense,
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
import { dprFor } from '../../lib/prefs';
import { testHooks } from '../../lib/env';
import { cameraFor, type CameraPose } from '../../lib/desk/camera';
import {
  createLineArt,
  prepareLineArt,
  sphereProbe,
  type LineArt,
} from './line-art';
import { resolveModelUrls } from './models';
import { ActiveContext, LineArtContext, useLineArt } from './scene-context';
import {
  countFrame,
  getProbeCamera,
  installSceneHooks,
  setCameraProbe,
  setSphereProbe,
} from './scene-hooks';

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

interface ObjectDef {
  id: string;
  model: string;
  p: [number, number, number];
  q: [number, number, number, number];
}

/** The shown objects, written into the HTML by Poster.astro (Scene never imports objects.ts). */
function readObjects(): ObjectDef[] {
  const raw = document
    .querySelector('[data-poster]')
    ?.getAttribute('data-objects');
  if (!raw) return [];
  try {
    return JSON.parse(raw) as ObjectDef[];
  } catch {
    return [];
  }
}

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
  children,
}: {
  url: string;
  def: ObjectDef;
  textured?: Record<string, Material>;
  sheet?: boolean;
  children?: (root: Object3D) => ReactNode;
}) {
  const art = useLineArt();
  const gltf = useGltf(url);
  const root = useMemo(() => {
    const clone = gltf.scene.clone(true);
    prepareLineArt(clone, art, { textured, sheet: sheet ?? false });
    return clone;
  }, [gltf, art, textured, sheet]);
  return (
    <group name={def.id} position={def.p} quaternion={def.q}>
      <primitive object={root} />
      {children?.(root)}
    </group>
  );
}

// ---- the desk ---------------------------------------------------------------------------------

function ObjectNode({ def, url }: { def: ObjectDef; url: string }) {
  // Behaviours (OLED, clock hands, calendar face, ghost eyes) arrive in E-03 and E-04.
  return <Model url={url} def={def} />;
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
  const sheetUrl = urls['sheet'];
  return (
    <>
      <group visible={!probeOn}>
        {sheetUrl ? (
          <Model
            url={sheetUrl}
            def={{ id: 'sheet', model: 'sheet', p: [0, 0, 0], q: [0, 0, 0, 1] }}
            sheet
          />
        ) : null}
        {objects.map((def) => {
          const url = urls[def.model];
          return url ? <ObjectNode key={def.id} def={def} url={url} /> : null;
        })}
      </group>
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

  useEffect(() => () => art.dispose(), [art]);

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
