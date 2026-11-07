/**
 * What the Scene knows about each shown object. Poster.astro writes it into `data-objects`
 * (only confirmed objects, from `getObjects()`), so the Scene chunk never imports
 * `content/objects.ts` and an unconfirmed object cannot ship in it.
 */
export type Vec3 = [number, number, number];

export interface ColliderDef {
  kind: 'cuboid' | 'ball' | 'capsule';
  args: number[];
  offset: Vec3;
}

export interface ObjectDef {
  id: string;
  /** GLB name without the extension. */
  model: string;
  p: Vec3;
  q: [number, number, number, number];
  collider: ColliderDef;
  mass: number;
  /** Section id such as `#work-car-sensors`. Decorative objects have none. */
  target?: string;
}

const isNums = (v: unknown, n: number): v is number[] =>
  Array.isArray(v) &&
  v.length === n &&
  v.every((x) => typeof x === 'number' && Number.isFinite(x));

function valid(o: unknown): o is ObjectDef {
  if (typeof o !== 'object' || o === null) return false;
  const d = o as Partial<ObjectDef>;
  const c = d.collider;
  return (
    typeof d.id === 'string' &&
    typeof d.model === 'string' &&
    isNums(d.p, 3) &&
    isNums(d.q, 4) &&
    typeof c === 'object' &&
    c !== null &&
    (c.kind === 'cuboid' || c.kind === 'ball' || c.kind === 'capsule') &&
    Array.isArray(c.args) &&
    isNums(c.offset, 3) &&
    typeof d.mass === 'number' &&
    (d.target === undefined ||
      (typeof d.target === 'string' && d.target.startsWith('#')))
  );
}

/** Parses the `data-objects` attribute; anything malformed is dropped, never thrown. */
export function parseObjects(raw: string | null | undefined): ObjectDef[] {
  if (!raw) return [];
  try {
    const list: unknown = JSON.parse(raw);
    return Array.isArray(list) ? list.filter(valid) : [];
  } catch {
    return [];
  }
}
