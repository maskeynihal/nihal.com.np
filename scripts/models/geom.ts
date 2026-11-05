/**
 * Geometry kit for the code-built models (D-06). Pure three.js geometry in Node, no DOM.
 * A `Part` is triangles (for the occluder / inverted hull) plus authored crease segments.
 * Which edges are lines is chosen per part in code, never by an angle threshold.
 */
import {
  BoxGeometry,
  BufferGeometry,
  CylinderGeometry,
  Matrix4,
  PlaneGeometry,
  SphereGeometry,
} from 'three';

export type Vec3 = [number, number, number];

export interface Part {
  /** xyz triples */
  positions: number[];
  /** xyz triples (unit) */
  normals: number[];
  /** triangle indices into positions/normals */
  indices: number[];
  /** flat xyz xyz pairs: authored crease segments, one segment per 6 numbers */
  lines: number[];
}

/** Round to 1e-6 m so output is identical across platforms. */
const r = (n: number) => Math.round(n * 1e6) / 1e6 + 0;

export function emptyPart(): Part {
  return { positions: [], normals: [], indices: [], lines: [] };
}

/** Append `src` into `dst`. */
export function merge(dst: Part, src: Part): Part {
  const base = dst.positions.length / 3;
  dst.positions.push(...src.positions);
  dst.normals.push(...src.normals);
  for (const i of src.indices) dst.indices.push(i + base);
  dst.lines.push(...src.lines);
  return dst;
}

export function mergeAll(parts: Part[]): Part {
  const out = emptyPart();
  for (const p of parts) merge(out, p);
  return out;
}

function fromGeometry(g: BufferGeometry, m: Matrix4): Part {
  g.applyMatrix4(m);
  const pos = g.getAttribute('position');
  const nor = g.getAttribute('normal');
  const idx = g.getIndex();
  const part = emptyPart();
  for (let i = 0; i < pos.count; i++) {
    part.positions.push(r(pos.getX(i)), r(pos.getY(i)), r(pos.getZ(i)));
    part.normals.push(r(nor.getX(i)), r(nor.getY(i)), r(nor.getZ(i)));
  }
  if (idx) for (let i = 0; i < idx.count; i++) part.indices.push(idx.getX(i));
  else for (let i = 0; i < pos.count; i++) part.indices.push(i);
  g.dispose();
  return part;
}

const at = (c: Vec3, rotX = 0) => {
  const m = new Matrix4().makeTranslation(c[0], c[1], c[2]);
  if (rotX) m.multiply(new Matrix4().makeRotationX(rotX));
  return m;
};

export const lineSeg = (a: Vec3, b: Vec3): number[] => [
  r(a[0]),
  r(a[1]),
  r(a[2]),
  r(b[0]),
  r(b[1]),
  r(b[2]),
];

/** The 12 edges of an axis-aligned box. */
export function boxEdges(min: Vec3, max: Vec3): number[] {
  const c = (i: number): Vec3 => [
    i & 1 ? max[0] : min[0],
    i & 2 ? max[1] : min[1],
    i & 4 ? max[2] : min[2],
  ];
  const pairs: [number, number][] = [
    [0, 1],
    [2, 3],
    [4, 5],
    [6, 7],
    [0, 2],
    [1, 3],
    [4, 6],
    [5, 7],
    [0, 4],
    [1, 5],
    [2, 6],
    [3, 7],
  ];
  return pairs.flatMap(([a, b]) => lineSeg(c(a), c(b)));
}

/** A closed ring in a plane: axis 'y' => xz plane, 'z' => xy plane, 'x' => yz plane. */
export function ringLines(
  centre: Vec3,
  radius: number,
  segments: number,
  axis: 'x' | 'y' | 'z' = 'y',
): number[] {
  const pt = (k: number): Vec3 => {
    const a = (k / segments) * Math.PI * 2;
    const u = Math.cos(a) * radius;
    const v = Math.sin(a) * radius;
    if (axis === 'y') return [centre[0] + u, centre[1], centre[2] + v];
    if (axis === 'z') return [centre[0] + u, centre[1] + v, centre[2]];
    return [centre[0], centre[1] + u, centre[2] + v];
  };
  const out: number[] = [];
  for (let k = 0; k < segments; k++) out.push(...lineSeg(pt(k), pt(k + 1)));
  return out;
}

export interface BoxOpts {
  /** centre */
  c: Vec3;
  /** full size */
  s: Vec3;
  /** author the 12 box edges as creases (default true) */
  edges?: boolean;
}

export function box({ c, s, edges = true }: BoxOpts): Part {
  const part = fromGeometry(new BoxGeometry(s[0], s[1], s[2]), at(c));
  if (edges) {
    part.lines.push(
      ...boxEdges(
        [c[0] - s[0] / 2, c[1] - s[1] / 2, c[2] - s[2] / 2],
        [c[0] + s[0] / 2, c[1] + s[1] / 2, c[2] + s[2] / 2],
      ),
    );
  }
  return part;
}

export interface CylOpts {
  /** centre */
  c: Vec3;
  radius: number;
  height: number;
  segments: number;
  /** axis of the cylinder */
  axis?: 'x' | 'y' | 'z';
  openEnded?: boolean;
  /** author both end rings as creases (default true) */
  rings?: boolean;
}

export function cylinder(o: CylOpts): Part {
  const axis = o.axis ?? 'y';
  const g = new CylinderGeometry(
    o.radius,
    o.radius,
    o.height,
    o.segments,
    1,
    o.openEnded ?? false,
  );
  const rot = new Matrix4();
  if (axis === 'z') rot.makeRotationX(Math.PI / 2);
  if (axis === 'x') rot.makeRotationZ(Math.PI / 2);
  const part = fromGeometry(g, at(o.c).multiply(rot));
  if (o.rings ?? true) {
    const h = o.height / 2;
    const off = (d: number): Vec3 =>
      axis === 'y'
        ? [o.c[0], o.c[1] + d, o.c[2]]
        : axis === 'z'
          ? [o.c[0], o.c[1], o.c[2] + d]
          : [o.c[0] + d, o.c[1], o.c[2]];
    part.lines.push(
      ...ringLines(off(h), o.radius, o.segments, axis),
      ...ringLines(off(-h), o.radius, o.segments, axis),
    );
  }
  return part;
}

export interface DomeOpts {
  /** centre of the sphere */
  c: Vec3;
  radius: number;
  widthSegments: number;
  heightSegments: number;
}

/** Upper hemisphere (y >= centre). Creases: none authored; caller adds rings it wants. */
export function dome(o: DomeOpts): Part {
  return fromGeometry(
    new SphereGeometry(
      o.radius,
      o.widthSegments,
      o.heightSegments,
      0,
      Math.PI * 2,
      0,
      Math.PI / 2,
    ),
    at(o.c),
  );
}

/** A flat quad facing +Y. */
export function floor(c: Vec3, w: number, d: number): Part {
  return fromGeometry(new PlaneGeometry(w, d), at(c, -Math.PI / 2));
}

export function bounds(p: Part): { min: Vec3; max: Vec3 } {
  const min: Vec3 = [Infinity, Infinity, Infinity];
  const max: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (let i = 0; i < p.positions.length; i += 3) {
    for (let k = 0; k < 3; k++) {
      const v = p.positions[i + k]!;
      if (v < min[k]!) min[k] = v;
      if (v > max[k]!) max[k] = v;
    }
  }
  return { min, max };
}

export const triCount = (p: Part) => p.indices.length / 3;
