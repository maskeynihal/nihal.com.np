import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deskNote } from '../../content/client-copy';
import { copy } from '../../content/copy';

let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv('PUBLIC_TEST_HOOKS', '1');
  window.__hooks = { ready: true, longTasks: [], errors: [] };
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  delete window.__hooks;
});

async function mountDesk() {
  const { default: Desk } = await import('./Desk');
  document.body.innerHTML =
    '<figure data-desk data-desk-state="poster"></figure>';
  const container = document.querySelector('[data-desk]') as HTMLElement;
  render(<Desk />, { container });
  await waitFor(() => expect(window.__hooks?.desk).toBeDefined());
  return container;
}

describe('fallback copy', () => {
  it('equals the string in copy.ts and the design spec', () => {
    expect(deskNote.lost).toBe(copy.status.lost);
    expect(deskNote.lost).toBe("3D paused. Reload if it doesn't come back.");
  });
});

describe('React default root (why Desk owns its root)', () => {
  it('logs a caught error with console.error', async () => {
    const { IslandBoundary } = await import('./IslandBoundary');
    function Bomb(): never {
      throw new Error('x');
    }
    const el = document.createElement('div');
    const root = createRoot(el);
    await act(async () => {
      root.render(
        <IslandBoundary island="t" fallback={() => null}>
          <Bomb />
        </IslandBoundary>,
      );
    });
    expect(errorSpy).toHaveBeenCalled();
    await act(async () => root.unmount());
  });
});

describe.each(['scene', 'chunk', 'shell', 'async'] as const)(
  'Desk failure path: %s',
  (kind) => {
    it('flips to failed, announces the note, reports once, no console.error', async () => {
      const figure = await mountDesk();
      expect(figure.dataset['deskState']).toBe('poster');
      const status = screen.getByRole('status');
      expect(status.textContent).toBe('');

      await act(async () => {
        window.__hooks?.desk?.fail(kind);
      });
      await waitFor(() => expect(figure.dataset['deskState']).toBe('failed'));
      expect(status.textContent).toBe(deskNote.lost);
      expect(window.__hooks?.errors).toHaveLength(1);
      expect(errorSpy).not.toHaveBeenCalled();
      expect(warnSpy).not.toHaveBeenCalled();
      expect(window.__hooks?.errors[0]?.phase).toBe(
        { scene: 'render', chunk: 'chunk', shell: 'render', async: 'async' }[
          kind
        ],
      );
    });
  },
);
