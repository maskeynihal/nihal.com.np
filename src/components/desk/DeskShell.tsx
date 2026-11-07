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
import { PHONE_QUERY, isPhoneWidth } from '../../lib/desk/phone';
import { testHooks } from '../../lib/env';
import { IslandBoundary, useIslandFailure } from './IslandBoundary';
import { registerDeskHooks } from './desk-hooks';
import type { ContextEvent } from './context-loss';

/** `paused` is a lost WebGL context waiting for its one restore: the poster and the note show. */
export type DeskStatus = 'poster' | 'live' | 'paused' | 'failed';
type SceneComponent = ComponentType<{
  onReady: () => void;
  onContext?: (e: ContextEvent) => void;
}>;

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
  // A context lost for good ends the Scene for the session (poster, note, GPU memory freed).
  const [gone, setGone] = useState(false);
  const goneRef = useRef(false);
  const failAsync = useIslandFailure();

  // Phone width has its own view and its own objects (fewer). Crossing 768 px (a rotation, a
  // resize) swaps the Scene for a fresh one built for the new width: the poster for that width
  // shows in between, and nothing of the old world (bodies, fall layer) is carried over.
  const [phone, setPhone] = useState(isPhoneWidth);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mq = window.matchMedia(PHONE_QUERY);
    const change = () => {
      setPhone(mq.matches);
      if (!goneRef.current) onStatus('poster');
    };
    mq.addEventListener('change', change);
    return () => mq.removeEventListener('change', change);
  }, [onStatus]);

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
      if (!cancelled && !goneRef.current && visible && idle) setWantScene(true);
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
        if (!goneRef.current) onStatus('poster');
      } else if (!goneRef.current) {
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
  const onContext = useCallback(
    (e: ContextEvent) => {
      if (e === 'lost') onStatus('paused');
      else if (e === 'restored') onStatus('live');
      else {
        goneRef.current = true;
        setGone(true);
        setWantScene(false);
        onStatus('failed');
      }
    },
    [onStatus],
  );

  if (crash) throw crash;

  const Active: SceneComponent | null = gone
    ? null
    : (override ?? (wantScene ? Scene : null));
  return (
    <div ref={hostRef} className="desk-canvas" aria-hidden="true">
      {Active ? (
        <IslandBoundary
          key={phone ? 'phone' : 'wide'}
          island="scene"
          fallback={() => null}
          onError={onFail}
        >
          <Suspense fallback={null}>
            <Active onReady={ready} onContext={onContext} />
          </Suspense>
        </IslandBoundary>
      ) : null}
    </div>
  );
}
