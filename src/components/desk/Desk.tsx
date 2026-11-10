import { useCallback, useEffect, useRef, useState } from 'react';
import { deskHint, deskNote } from '../../content/client-copy';
import { DeskShell, type DeskStatus } from './DeskShell';
import { IslandRoot } from './island-root';
import { DESK_RESET_EVENT } from '../../lib/desk/bus';
import { installGlobalErrorReporting } from './island-errors';
import { hintSeen, markHintSeen } from '../../lib/desk/hint';
import { reactions } from '../../lib/desk/reactions';

/**
 * The `client:only="react"` entry. It is deliberately tiny and cannot fail on its own.
 *
 * The poster is server-rendered Astro outside this island and visible by default (no JS,
 * island never mounts, island fails). This component only reflects state: it sets
 * `data-desk-state` on the wrapping `[data-desk]` figure (`poster` | `live` | `failed`)
 * and writes the note into a persistent `role="status"` element (an element that already
 * exists announces more reliably than one inserted with its text). Only a positive
 * state (`live`, E-01) may ever hide the poster; `failed` always shows it.
 * `paused` (a lost WebGL context with its one restore pending) is `poster` plus the note.
 *
 * The canvas layer (`.desk-live`) overlays the poster; CSS crossfades them on `data-desk-state`.
 * The drag hint, the reset button and the OLED caption are Astro markup in `Poster.astro`
 * (visible text must exist without this island); this component only wires the button.
 */
export default function Desk() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<DeskStatus>('poster');
  // First visit: one line that says the desk can be touched, until it is dismissed or touched.
  const [dismissed, setDismissed] = useState(false);
  const hint = status === 'live' && !dismissed && !hintSeen();

  // `failed` is final for the page; `live` never overrides it.
  const onStatus = useCallback(
    (next: DeskStatus) =>
      setStatus((prev) => (prev === 'failed' ? prev : next)),
    [],
  );

  useEffect(() => {
    const figure = wrapRef.current?.closest<HTMLElement>('[data-desk]');
    // `paused` (context lost, one restore pending) shows the poster like `poster` does.
    if (figure)
      figure.dataset['deskState'] = status === 'paused' ? 'poster' : status;
  }, [status]);

  // "reset the desk" lives in Poster.astro; the Scene (E-05) listens for the event.
  useEffect(() => {
    const button = wrapRef.current
      ?.closest<HTMLElement>('[data-desk]')
      ?.querySelector<HTMLButtonElement>('[data-desk-reset]');
    if (!button) return;
    const reset = () => window.dispatchEvent(new CustomEvent(DESK_RESET_EVENT));
    button.addEventListener('click', reset);
    return () => button.removeEventListener('click', reset);
  }, []);

  const dismissHint = useCallback(() => {
    markHintSeen();
    setDismissed(true);
  }, []);

  // Touching anything on the desk (a tap, a button in the object list) is the answer to the hint.
  useEffect(() => {
    if (!hint) return;
    const off = reactions.subscribe(dismissHint);
    const grab = () => dismissHint();
    window.addEventListener('nihal:drag', grab);
    return () => {
      off();
      window.removeEventListener('nihal:drag', grab);
    };
  }, [hint, dismissHint]);

  useEffect(
    () => installGlobalErrorReporting(() => onStatus('failed')),
    [onStatus],
  );

  return (
    <div ref={wrapRef} className="desk-island">
      <IslandRoot className="desk-live">
        <DeskShell onStatus={onStatus} />
      </IslandRoot>
      <p role="status" className="label desk-note">
        {status === 'failed' || status === 'paused' ? deskNote.lost : ''}
      </p>
      {hint && status === 'live' ? (
        <p className="label desk-hint">
          {deskHint.hint}{' '}
          <button type="button" onClick={dismissHint}>
            {deskHint.dismiss}
          </button>
        </p>
      ) : null}
    </div>
  );
}
