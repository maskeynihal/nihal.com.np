/**
 * The only content module client `<script>`s may import. Literal primitives, no
 * object graph, so nothing else from `copy.ts` can be pulled into a public chunk.
 * `client-copy.test.ts` keeps these equal to `copy.ts`.
 */
export const soundLabel = { on: 'on', off: 'off' } as const;
