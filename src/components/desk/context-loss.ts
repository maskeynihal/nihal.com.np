/**
 * WebGL context loss policy (design 4.8): the first loss is paused (poster and note) and waits
 * for one restore; a second loss, or a restore that never comes, is final for the session.
 * Pure: the Scene wires the events, the shell wires the status.
 */
export type ContextEvent = 'lost' | 'restored' | 'permanent';

/** How long the first loss waits for a restore before it is final, ms. */
export const RESTORE_WAIT_MS = 4000;

export interface ContextPolicy {
  /** The canvas lost its context. */
  lost(): void;
  /** The browser gave it back. */
  restored(): void;
  /** Cancels the pending wait. */
  dispose(): void;
}

export function createContextPolicy(
  emit: (e: ContextEvent) => void,
  wait: (cb: () => void, ms: number) => unknown = setTimeout,
  cancel: (t: unknown) => void = (t) =>
    clearTimeout(t as ReturnType<typeof setTimeout>),
): ContextPolicy {
  let losses = 0;
  let permanent = false;
  let timer: unknown;
  const finish = () => {
    if (permanent) return;
    permanent = true;
    emit('permanent');
  };
  return {
    lost() {
      if (permanent) return;
      losses += 1;
      if (timer !== undefined) cancel(timer);
      if (losses > 1) return finish();
      emit('lost');
      timer = wait(finish, RESTORE_WAIT_MS);
    },
    restored() {
      if (permanent || losses === 0) return;
      if (timer !== undefined) cancel(timer);
      timer = undefined;
      emit('restored');
    },
    dispose() {
      if (timer !== undefined) cancel(timer);
      timer = undefined;
    },
  };
}
