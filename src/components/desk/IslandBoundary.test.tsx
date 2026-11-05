import { Suspense, lazy, useEffect } from 'react';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IslandBoundary, classify, useIslandFailure } from './IslandBoundary';
import { resetReported } from '../../lib/report-error';

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  resetReported();
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  // React logs caught errors with console.error by default (see Desk.test.tsx).
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const fallback = () => <p>fallback shown</p>;

function Bomb({ message = 'render bomb' }: { message?: string }): never {
  throw new Error(message);
}

describe('IslandBoundary', () => {
  it('renders children when nothing fails', () => {
    render(
      <IslandBoundary island="scene" fallback={fallback}>
        <p>fine</p>
      </IslandBoundary>,
    );
    expect(screen.getByText('fine')).toBeTruthy();
    expect(warn).not.toHaveBeenCalled();
  });

  it('catches a render error, reports it once and calls onError', () => {
    const onError = vi.fn();
    render(
      <IslandBoundary island="scene" fallback={fallback} onError={onError}>
        <Bomb />
      </IslandBoundary>,
    );
    expect(screen.getByText('fallback shown')).toBeTruthy();
    expect(onError).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]).toEqual([
      '[nihal]',
      'scene',
      'render',
      'Error',
      'render bomb',
    ]);
  });

  it('catches an error thrown in an effect (lifecycle)', () => {
    function Effect() {
      useEffect(() => {
        throw new Error('effect bomb');
      }, []);
      return null;
    }
    render(
      <IslandBoundary island="scene" fallback={fallback}>
        <Effect />
      </IslandBoundary>,
    );
    expect(screen.getByText('fallback shown')).toBeTruthy();
  });

  it('catches a rejected React.lazy import and classifies it as a chunk failure', async () => {
    const Broken = lazy<() => null>(() =>
      Promise.reject(
        new TypeError('Failed to fetch dynamically imported module: /x.js'),
      ),
    );
    render(
      <IslandBoundary island="scene" fallback={fallback}>
        <Suspense fallback={null}>
          <Broken />
        </Suspense>
      </IslandBoundary>,
    );
    await screen.findByText('fallback shown');
    expect(warn.mock.calls[0]?.slice(0, 3)).toEqual([
      '[nihal]',
      'scene',
      'chunk',
    ]);
  });

  it('routes an async error through useIslandFailure into the fallback', async () => {
    function Child() {
      const fail = useIslandFailure();
      return (
        <button
          type="button"
          onClick={() => {
            void Promise.reject(new Error('later')).catch(fail);
          }}
        >
          go
        </button>
      );
    }
    render(
      <IslandBoundary island="desk" fallback={fallback}>
        <Child />
      </IslandBoundary>,
    );
    await act(async () => {
      fireEvent.click(screen.getByText('go'));
    });
    expect(screen.getByText('fallback shown')).toBeTruthy();
    expect(warn.mock.calls[0]).toEqual([
      '[nihal]',
      'desk',
      'async',
      'Error',
      'later',
    ]);
  });

  it('keeps the fallback if onError throws', () => {
    render(
      <IslandBoundary
        island="scene"
        fallback={fallback}
        onError={() => {
          throw new Error('observer');
        }}
      >
        <Bomb />
      </IslandBoundary>,
    );
    expect(screen.getByText('fallback shown')).toBeTruthy();
  });

  it('a failing sibling boundary does not affect the other', () => {
    render(
      <>
        <IslandBoundary island="a" fallback={fallback}>
          <Bomb />
        </IslandBoundary>
        <IslandBoundary island="b" fallback={fallback}>
          <p>b is fine</p>
        </IslandBoundary>
      </>,
    );
    expect(screen.getByText('b is fine')).toBeTruthy();
  });
});

describe('classify', () => {
  it('detects chunk load failures by engine message', () => {
    for (const m of [
      'Failed to fetch dynamically imported module: x',
      'error loading dynamically imported module: x',
      'Importing a module script failed.',
    ])
      expect(classify(new TypeError(m)).phase).toBe('chunk');
  });
  it('treats other errors and non-errors as render', () => {
    expect(classify(new TypeError('x is not a function')).phase).toBe('render');
    expect(classify('string').phase).toBe('render');
  });
});
