import { useEffect } from 'react';

/**
 * Placeholder for the real three/R3F scene (Epics C/D/E). It is loaded with
 * `React.lazy` from `DeskShell`, so it must stay out of the initial graph: nothing
 * outside this file may import it statically (`pnpm check:graph` enforces that).
 * Heavy imports (three, @react-three/*) belong here, never in the shell.
 */
export default function Scene({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);
  return <div data-scene aria-hidden="true" />;
}
