import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Color, type PerspectiveCamera } from 'three';
import { dprFor } from '../../lib/prefs';
import { testHooks } from '../../lib/env';
import { cameraFor, type CameraPose } from '../../lib/desk/camera';
import { readToken } from '../../lib/desk/tokens';
import { countFrame, installSceneHooks, setCameraProbe } from './scene-hooks';

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
 * `frameloop="demand"`: anything that changes a pixel calls `invalidate()`.
 * E-01 is the empty blue canvas: the models and the line-art passes arrive in E-02.
 */

function applyPose(cam: PerspectiveCamera, pose: CameraPose): void {
  cam.fov = pose.fov;
  cam.near = pose.near;
  cam.far = pose.far;
  cam.position.set(...pose.position);
  cam.lookAt(...pose.lookAt);
  cam.updateProjectionMatrix();
  cam.updateMatrixWorld();
}

/** On screen (within one viewport) and the tab is showing. Pauses the loop. */
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

function Rig() {
  const { camera, size, invalidate, gl } = useThree();
  useLayoutEffect(() => {
    applyPose(camera as PerspectiveCamera, cameraFor(window.innerWidth));
    setCameraProbe(camera as PerspectiveCamera, size);
    invalidate();
  }, [camera, size, invalidate]);
  useEffect(() => {
    gl.domElement.setAttribute('aria-hidden', 'true');
  }, [gl]);
  return null;
}

/** Calls `onReady` once, after the first frame has been drawn. */
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

export default function Scene({ onReady }: { onReady: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);
  const active = useActiveState(hostRef);
  const [blue] = useState(() => new Color(readToken('--blue')));

  useEffect(() => installSceneHooks(), []);

  return (
    <div ref={hostRef} style={{ width: '100%', height: '100%' }}>
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
          gl.setClearColor(blue, 1);
        }}
      >
        <Rig />
        <Ready onReady={onReady} />
        {testHooks ? <FrameCounter /> : null}
      </Canvas>
    </div>
  );
}
