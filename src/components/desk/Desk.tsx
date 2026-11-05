import { useCallback, useEffect, useRef, useState } from 'react';
import { deskNote } from '../../content/client-copy';
import { DeskShell, type DeskStatus } from './DeskShell';
import { IslandRoot } from './island-root';
import { installGlobalErrorReporting } from './island-errors';

/**
 * The `client:only="react"` entry. It is deliberately tiny and cannot fail on its own.
 *
 * The poster is server-rendered Astro outside this island and visible by default (no JS,
 * island never mounts, island fails). This component only reflects state: it sets
 * `data-desk-state` on the wrapping `[data-desk]` figure (`poster` | `live` | `failed`)
 * and writes the note into a persistent `role="status"` element (an element that already
 * exists announces more reliably than one inserted with its text). Only a positive
 * state (`live`, E-01) may ever hide the poster; `failed` always shows it.
 */
export default function Desk() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<DeskStatus>('poster');

  // `failed` is final for the page; `live` never overrides it.
  const onStatus = useCallback(
    (next: DeskStatus) =>
      setStatus((prev) => (prev === 'failed' ? prev : next)),
    [],
  );

  useEffect(() => {
    const figure = wrapRef.current?.closest<HTMLElement>('[data-desk]');
    if (figure) figure.dataset['deskState'] = status;
  }, [status]);

  useEffect(
    () => installGlobalErrorReporting(() => onStatus('failed')),
    [onStatus],
  );

  return (
    <div ref={wrapRef}>
      <IslandRoot>
        <DeskShell onStatus={onStatus} />
      </IslandRoot>
      <p role="status" className="label desk-note">
        {status === 'failed' ? deskNote.lost : ''}
      </p>
    </div>
  );
}
