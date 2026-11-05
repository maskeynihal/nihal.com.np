import {
  Suspense,
  lazy,
  useCallback,
  useEffect,
  useState,
  type ComponentType,
} from 'react';
import { onIdle, canRun3D } from '../../lib/prefs';
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

  // Poster first; the Scene chunk is requested only when the device can run it and is idle.
  useEffect(() => {
    if (canRun3D()) onIdle(() => setWantScene(true));
  }, []);

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
  return Active ? (
    <IslandBoundary island="scene" fallback={() => null} onError={onFail}>
      <Suspense fallback={null}>
        <Active onReady={ready} />
      </Suspense>
    </IslandBoundary>
  ) : null;
}
