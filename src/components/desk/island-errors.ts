import { reportError } from '../../lib/report-error';

/**
 * Chunks that belong to the desk island. Production names are hashed
 * (`Scene.AbC123.js`); dev serves `/src/components/desk/Scene.tsx`.
 */
const DESK_SOURCE =
  /(?:^|[/\\])(?:Desk|DeskShell|Scene|desk-vendor|physics)[.\w-]*\.(?:m?js|tsx?)\b/;

export function isDeskSource(text: unknown): boolean {
  return typeof text === 'string' && DESK_SOURCE.test(text);
}

/**
 * Reports `error` / `unhandledrejection` events that come from desk code and tells the
 * caller to fall back. Events from any other script are left alone: no report, no
 * `preventDefault`, no state change. Returns the cleanup.
 */
export function installGlobalErrorReporting(onDeskFailure: () => void) {
  const onError = (ev: ErrorEvent) => {
    const stack =
      typeof ev.error === 'object' && ev.error !== null
        ? (ev.error as { stack?: unknown }).stack
        : undefined;
    if (!isDeskSource(ev.filename) && !isDeskSource(stack)) return;
    ev.preventDefault();
    reportError(ev.error ?? ev.message, { island: 'desk', phase: 'global' });
    onDeskFailure();
  };
  const onRejection = (ev: PromiseRejectionEvent) => {
    const reason: unknown = ev.reason;
    const stack =
      typeof reason === 'object' && reason !== null
        ? (reason as { stack?: unknown }).stack
        : undefined;
    if (!isDeskSource(stack)) return;
    ev.preventDefault();
    reportError(reason, { island: 'desk', phase: 'global' });
    onDeskFailure();
  };
  window.addEventListener('error', onError);
  window.addEventListener('unhandledrejection', onRejection);
  return () => {
    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);
  };
}
