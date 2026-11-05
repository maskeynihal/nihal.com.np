import { testHooks } from './env';

/**
 * The one logging hook for handled client failures (A-10).
 *
 * - Never leaves the device: no fetch, no beacon, no analytics.
 * - Records only island, phase, error name and a truncated message. No component
 *   stack, no props, no page text, so unconfirmed copy cannot leak through it.
 * - Never throws (it runs inside error handlers) and reports each distinct
 *   (island, phase, name, message) once per page load.
 * - Plain build: one `console.warn` with the stable prefix `[nihal]`.
 *   A warning, not an error: the failure was handled and the page works.
 * - `PUBLIC_TEST_HOOKS` build: also pushes the record to `window.__hooks.errors`.
 *   Failures that a test triggers on purpose (`markIntentional`) skip the warn, so
 *   the console-fail fixture stays strict for every accidental one.
 */
export type ErrorPhase = 'render' | 'chunk' | 'async' | 'global';

export interface ReportContext {
  island: string;
  phase: ErrorPhase;
}

export interface ErrorRecord {
  island: string;
  phase: string;
  name: string;
  message: string;
}

export const PREFIX = '[nihal]';
const MAX_MESSAGE = 200;
const MAX_SEEN = 50;

const seen = new Set<string>();
const intentional = new WeakSet<object>();

/** Hooks builds only: flags an error a test raised on purpose. No-op in the plain build. */
export function markIntentional<T>(error: T): T {
  if (testHooks && typeof error === 'object' && error !== null)
    intentional.add(error);
  return error;
}

/** Forget what was reported (tests only). */
export function resetReported(): void {
  seen.clear();
}

function safeString(value: unknown): string {
  try {
    return String(value);
  } catch {
    return '';
  }
}

function describe(error: unknown): { name: string; message: string } {
  let name = 'Error';
  let message = '';
  try {
    if (typeof error === 'object' && error !== null) {
      const e = error as { name?: unknown; message?: unknown };
      name = typeof e.name === 'string' && e.name !== '' ? e.name : 'Error';
      message = typeof e.message === 'string' ? e.message : '';
    } else {
      name = typeof error;
      message = safeString(error);
    }
  } catch {
    // A throwing getter or Proxy: keep the defaults.
  }
  return { name, message: message.slice(0, MAX_MESSAGE) };
}

export function reportError(error: unknown, ctx: ReportContext): void {
  try {
    const { name, message } = describe(error);
    const record: ErrorRecord = {
      island: ctx.island,
      phase: ctx.phase,
      name,
      message,
    };
    const key = `${record.island}|${record.phase}|${name}|${message}`;
    if (seen.has(key)) return;
    if (seen.size >= MAX_SEEN) seen.clear();
    seen.add(key);

    let quiet = false;
    if (testHooks) {
      quiet =
        typeof error === 'object' && error !== null && intentional.has(error);
      window.__hooks?.errors.push(record);
    }
    if (!quiet)
      console.warn(PREFIX, record.island, record.phase, name, message);
  } catch {
    // Reporting must never be the thing that fails.
  }
}
