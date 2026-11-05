import {
  Component,
  useCallback,
  useState,
  type ErrorInfo,
  type ReactNode,
} from 'react';
import { reportError, type ErrorPhase } from '../../lib/report-error';

/** Wraps an error routed in from outside React (event handler, promise, timer). */
export class AsyncIslandError extends Error {
  constructor(override readonly cause: unknown) {
    super('async island failure');
    this.name = 'AsyncIslandError';
  }
}

/**
 * Event-handler and async errors are not caught by boundaries. Call the returned
 * function from them: it rethrows during the next render of the calling component,
 * so the nearest `IslandBoundary` above it shows its fallback.
 */
export function useIslandFailure(): (error: unknown) => void {
  const [, setState] = useState<void>();
  return useCallback((error: unknown) => {
    setState(() => {
      throw new AsyncIslandError(error);
    });
  }, []);
}

const CHUNK_FAILURE =
  /dynamically imported module|importing a module script failed|loading chunk|failed to fetch|error loading dynamically/i;

export function classify(error: unknown): {
  error: unknown;
  phase: ErrorPhase;
} {
  if (error instanceof AsyncIslandError)
    return { error: error.cause, phase: 'async' };
  if (error instanceof Error) {
    const chunk =
      error.name === 'ChunkLoadError' ||
      (error.name === 'TypeError' && CHUNK_FAILURE.test(error.message));
    if (chunk) return { error, phase: 'chunk' };
  }
  return { error, phase: 'render' };
}

interface Props {
  /** Names the island in the report, e.g. `desk` or `scene`. */
  island: string;
  /** What to render instead of the children after a failure. */
  fallback: (error: unknown) => ReactNode;
  /** Called once per caught error, after it was reported. Must not throw. */
  onError?: (error: unknown, info: ErrorInfo) => void;
  children?: ReactNode;
}

interface State {
  failed: boolean;
  error: unknown;
}

/**
 * Catches errors thrown while rendering, in lifecycles, and by `React.lazy` when a
 * chunk fails to load (the rejection is rethrown at render). Reports through
 * `reportError`, the only reporting site, then renders `fallback`.
 */
export class IslandBoundary extends Component<Props, State> {
  override state: State = { failed: false, error: undefined };

  static getDerivedStateFromError(error: unknown): State {
    return { failed: true, error };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    const { error: cause, phase } = classify(error);
    reportError(cause, { island: this.props.island, phase });
    try {
      this.props.onError?.(cause, info);
    } catch {
      // A failing observer must not break the fallback.
    }
  }

  override render(): ReactNode {
    return this.state.failed
      ? this.props.fallback(this.state.error)
      : this.props.children;
  }
}
