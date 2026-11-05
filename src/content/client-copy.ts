/**
 * The only content module client `<script>`s may import. Literal primitives, no
 * object graph, so nothing else from `copy.ts` can be pulled into a public chunk.
 * `content.test.ts` ("client-copy matches copy.ts") keeps these equal to `copy.ts`.
 */
export const soundLabel = { on: 'on', off: 'off' } as const;

/** Shown when the 3D desk fails (A-10). Equal to `copy.status.lost`; pinned by `content.test.ts`. */
export const deskNote = {
  lost: "3D paused. Reload if it doesn't come back.",
} as const;
