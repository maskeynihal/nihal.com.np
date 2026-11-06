import { Suspense, lazy, useEffect, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import type { PerspectiveCamera } from 'three';
import { heroCamera, posterAspect } from '../../assets/camera';
import { dprFor } from '../../lib/prefs';
import { THEME_EVENT } from '../../lib/desk/tokens';
import type { LineArt } from './line-art';
import { LineArtContext } from './scene-context';
import { fallBridge, physicsBridge } from './physics-bridge';
import { IslandBoundary } from './IslandBoundary';
import { table } from './table';
import { countFallFrame } from './scene-hooks';
import { testHooks } from '../../lib/env';

/**
 * The second canvas: fixed, the whole viewport, transparent, never an event target. It exists only
 * while something has left the table (`Scene` mounts it when the physics asks, and unmounts it
 * when it is empty, which frees its WebGL context). Free objects live in its scene and fall in
 * its physics world (`physics/fall-world.tsx`, the same lazy chunk as the table's).
 *
 * Its camera is the table camera with a different frame: same field of view and focal length in
 * pixels, but the view is offset so the viewport shows what the table canvas showed where it was
 * on screen when this canvas was mounted. The shared line materials get this canvas's size just
 * before it draws.
 */
const FallPhysics = lazy(() =>
  import('./physics').then((m) => ({ default: m.FallPhysics })),
);

function FallRig({ art }: { art: LineArt }) {
  const { camera, size, invalidate, gl } = useThree();
  const frame = fallBridge.frame();

  useLayoutEffect(() => {
    if (!frame) return;
    const cam = camera as PerspectiveCamera;
    (cam as unknown as { manual: boolean }).manual = true;
    cam.fov = heroCamera.fov;
    cam.near = 0.05;
    cam.far = 30;
    cam.aspect = posterAspect;
    cam.position.set(0, 0, 0);
    cam.rotation.set(0, 0, 0);
    // The viewport is a window onto the table canvas's picture, at the place the canvas was.
    cam.aspect = frame.w / frame.h;
    cam.setViewOffset(
      frame.w,
      frame.h,
      -frame.left,
      -frame.top,
      size.width,
      size.height,
    );
    cam.updateProjectionMatrix();
    cam.updateMatrixWorld(true);
    invalidate();
  }, [camera, frame, size, invalidate]);

  useFrame(() => {
    art.setResolution(size.width, size.height);
    if (testHooks) countFallFrame();
  }, -100);
  useEffect(() => {
    gl.domElement.setAttribute('aria-hidden', 'true');
  }, [gl]);
  useEffect(() => {
    const repaint = () => invalidate();
    window.addEventListener(THEME_EVENT, repaint);
    return () => window.removeEventListener(THEME_EVENT, repaint);
  }, [invalidate]);
  // A lost context takes the free objects home rather than leaving them invisible.
  useEffect(() => {
    const el = gl.domElement;
    const lost = (e: Event) => {
      e.preventDefault();
      physicsBridge.api()?.reset();
    };
    el.addEventListener('webglcontextlost', lost);
    return () => el.removeEventListener('webglcontextlost', lost);
  }, [gl]);
  return null;
}

export function FallLayer({ art, paused }: { art: LineArt; paused: boolean }) {
  const frame = fallBridge.frame();
  if (!frame || typeof document === 'undefined') return null;
  return createPortal(
    <div className="desk-fall" aria-hidden="true">
      <LineArtContext.Provider value={art}>
        <Canvas
          frameloop={paused ? 'never' : 'demand'}
          flat
          dpr={dprFor()}
          gl={{
            alpha: true,
            antialias: true,
            powerPreference: 'low-power',
            depth: true,
          }}
          camera={{ fov: heroCamera.fov, near: 0.05, far: 30 }}
          resize={{ debounce: 0, scroll: false }}
          onCreated={({ gl }) => {
            gl.setClearColor(0x000000, 0);
          }}
        >
          <FallRig art={art} />
          <IslandBoundary
            island="fall"
            fallback={() => null}
            onError={() => {
              physicsBridge.api()?.reset();
              fallBridge.release();
            }}
          >
            <Suspense fallback={null}>
              <FallPhysics
                anchor={frame}
                onEmpty={() => {
                  if (!table.scene) return;
                  fallBridge.release();
                }}
              />
            </Suspense>
          </IslandBoundary>
        </Canvas>
      </LineArtContext.Provider>
    </div>,
    document.body,
  );
}
