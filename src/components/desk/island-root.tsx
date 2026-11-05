import { useEffect, useRef, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';

/**
 * Renders `children` in a React root that this component owns.
 *
 * Why: React 19's default `onCaughtError` is `console.error(error)` in production too,
 * so every error an `IslandBoundary` handles would show up as a red console error. The
 * root that Astro creates for `client:only` takes no options (`createRoot(element)`), so
 * the only way to pass `onCaughtError` is to own a root. Caught errors are already
 * reported once by the boundary, so the root's callback stays silent. Uncaught errors keep
 * React's default (a window `error` event), which the global reporter picks up.
 * Reuse this for any island with boundaries (ContactForm, B-06b).
 */
export function IslandRoot({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const hostRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<ReturnType<typeof createRoot> | null>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const root = createRoot(host, { onCaughtError: () => {} });
    rootRef.current = root;
    return () => {
      rootRef.current = null;
      // Unmounting synchronously inside the outer commit warns.
      queueMicrotask(() => root.unmount());
    };
  }, []);

  // Runs after the effect above on the first commit, so it also does the first render.
  useEffect(() => {
    rootRef.current?.render(children);
  });

  return <div ref={hostRef} className={className} />;
}
