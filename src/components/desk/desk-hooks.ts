import { lazy, type ComponentType } from 'react';
import { testHooks } from '../../lib/env';
import { markIntentional } from '../../lib/report-error';

export interface DeskHookControls {
  /** Replaces the lazy Scene with another component (or restores it with null). */
  setScene: (c: ComponentType<{ onReady: () => void }> | null) => void;
  /** Makes the shell throw during its next render. */
  crashShell: (error: Error) => void;
  /** The `useIslandFailure()` setter. */
  failAsync: (error: unknown) => void;
}

function ThrowingScene(): never {
  throw markIntentional(new Error('desk test fault: scene render'));
}

/** Test-only (`PUBLIC_TEST_HOOKS=1`); the plain build drops this whole module. */
export function registerDeskHooks(controls: DeskHookControls): void {
  if (!testHooks) return;
  const hooks = window.__hooks;
  if (!hooks) return;
  hooks.desk = {
    fail(kind) {
      switch (kind) {
        case 'scene':
          controls.setScene(ThrowingScene);
          break;
        case 'chunk': {
          // A rejected dynamic import, as when the chunk request fails offline.
          const Broken = lazy<ComponentType<{ onReady: () => void }>>(() =>
            Promise.reject(
              markIntentional(
                new TypeError(
                  'Failed to fetch dynamically imported module: desk test fault',
                ),
              ),
            ),
          );
          controls.setScene(Broken);
          break;
        }
        case 'shell':
          controls.crashShell(
            markIntentional(new Error('desk test fault: shell render')),
          );
          break;
        case 'async':
          // A rejected promise, which no boundary sees on its own.
          void Promise.reject(
            markIntentional(new Error('desk test fault: async')),
          ).catch(controls.failAsync);
          break;
      }
    },
    state() {
      return (
        document.querySelector<HTMLElement>('[data-desk]')?.dataset[
          'deskState'
        ] ?? ''
      );
    },
  };
}
