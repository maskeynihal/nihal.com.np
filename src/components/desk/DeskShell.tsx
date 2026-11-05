import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ComponentType,
} from 'react';
import { onIdle, canRun3D, getMotion, subscribeMotion } from '../../lib/prefs';
import { testHooks } from '../../lib/env';
import { IslandBoundary, useIslandFailure } from './IslandBoundary';
import { registerDeskHooks } from './desk-hooks';

export type DeskStatus = 'poster' | 'live' | 'failed';
type SceneComponent = ComponentType<{ onReady: () => void }>;

// The only reference to Scene is this dynamic import, so it gets its own chunk.
const Scene = lazy(() => import('./Scene'));

/**
 * The desk shell. Imports nothing from three or anything heavy.
 * Two boundaries: the outer one covers the shell, the inner one covers the lazy Scene.
 * Both end in the same fallback: the poster (server-rendered, always in the DOM) stays
 * visible and the host shows the note. This component only reports a status.
 */
export function DeskShell({ onStatus }: { onStatus: (s: DeskStatus) => void }) {
  const fail = useCallback(() => onStatus('failed'), [onStatus]);
  return (
    <IslandBoundary island="desk" fallback={() => null} onError={fail}>
      <DeskContent onStatus={onStatus} onFail={fail} />
    </IslandBoundary>
  );
}

function DeskContent({
  onStatus,
  onFail,
}: {
  onStatus: (s: DeskStatus) => void;
  onFail: () => void;
}) {
  const [wantScene, setWantScene] = useState(false);
  const [override, setOverride] = useState<SceneComponent | null>(null);
  const [crash, setCrash] = useState<Error | null>(null);
  const failAsync = useIslandFailure();

  // Poster first. The Scene chunk is requested only when the device can run it, the hero is in
  // view and the browser is idle. Switching motion off while live goes back to the poster (and
  // frees the Scene); switching it on again starts the same path.
  const hostRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let cancelled = false;
    let visible = false;
    let idle = false;
    let observer: IntersectionObserver | undefined;
    const settle = () => {
      if (!cancelled && visible && idle) setWantScene(true);
    };
    const start = () => {
      if (!canRun3D()) return;
      const figure = hostRef.current?.closest('[data-desk]');
      if (figure && typeof IntersectionObserver === 'function') {
        observer = new IntersectionObserver((entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            visible = true;
            observer?.disconnect();
            settle();
          }
        });
        observer.observe(figure);
      } else {
        visible = true;
      }
      onIdle(() => {
        idle = true;
        settle();
      });
    };
    const stop = () => {
      cancelled = true;
      observer?.disconnect();
    };
    if (getMotion() === 'full') start();
    const unsubscribe = subscribeMotion((m) => {
      stop();
      if (m === 'reduce') {
        setWantScene(false);
        onStatus('poster');
      } else {
        cancelled = false;
        visible = false;
        idle = false;
        start();
      }
    });
    return () => {
      stop();
      unsubscribe();
    };
  }, [onStatus]);

  useEffect(() => {
    if (testHooks)
      registerDeskHooks({
        setScene: (c) => setOverride(() => c),
        crashShell: setCrash,
        failAsync,
      });
  }, [failAsync]);

  const ready = useCallback(() => onStatus('live'), [onStatus]);

  if (crash) throw crash;

  const Active: SceneComponent | null = override ?? (wantScene ? Scene : null);
  return (
    <div ref={hostRef} className="desk-canvas" aria-hidden="true">
      {Active ? (
        <IslandBoundary island="scene" fallback={() => null} onError={onFail}>
          <Suspense fallback={null}>
            <Active onReady={ready} />
          </Suspense>
        </IslandBoundary>
      ) : null}
    </div>
  );
}
