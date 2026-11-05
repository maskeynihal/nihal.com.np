/**
 * Poster generator (D-01). Projects the same models the GLBs are built from (authored creases
 * plus silhouette edges taken from the triangles, back lines removed) through the fixed hero
 * camera in `src/assets/camera.ts` into `src/assets/poster.svg`. 2D and 3D match by construction.
 *
 * Silhouette edge: a welded mesh edge where one adjacent triangle faces the camera and the
 * other does not (or a boundary edge of a front triangle). Hidden-line removal: each segment
 * is sampled and ray-tested against the occluding triangles, boundaries refined by bisection.
 */
import { optimize } from 'svgo';
import { Matrix4, PerspectiveCamera, Quaternion, Vector3 } from 'three';
import {
  heroCamera,
  posterAspect,
  posterViewBox,
} from '../../src/assets/camera';
import { objects } from '../../src/content/objects';
import { models, type ModelDef } from './models';
import type { Part } from './geom';

type V = [number, number, number];

interface Placed {
  tris: V[][]; // world-space triangles (3 points each)
  creases: [V, V][];
  structural: boolean;
}

const EPS_LIFT = 2e-4;
const EPS_HIT = 1e-4;
const PRECISION = 1;

const cam = new PerspectiveCamera(
  heroCamera.fov,
  posterAspect,
  heroCamera.near,
  heroCamera.far,
);
cam.position.set(...heroCamera.position);
cam.lookAt(...heroCamera.lookAt);
cam.updateMatrixWorld(true);
cam.updateProjectionMatrix();
const camPos: V = [...heroCamera.position];
const viewProj = new Matrix4().multiplyMatrices(
  cam.projectionMatrix,
  cam.matrixWorldInverse,
);

const sub = (a: V, b: V): V => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const dot = (a: V, b: V) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const cross = (a: V, b: V): V => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
const lerp = (a: V, b: V, t: number): V => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
const len = (a: V) => Math.hypot(a[0], a[1], a[2]);

function place(part: Part, p: V, q: [number, number, number, number]): Placed {
  const quat = new Quaternion(q[0], q[1], q[2], q[3]);
  const off = new Vector3(...p);
  const w = (i: number): V => {
    const v = new Vector3(
      part.positions[i * 3]!,
      part.positions[i * 3 + 1]!,
      part.positions[i * 3 + 2]!,
    )
      .applyQuaternion(quat)
      .add(off);
    return [v.x, v.y, v.z];
  };
  const tris: V[][] = [];
  for (let i = 0; i < part.indices.length; i += 3) {
    tris.push([
      w(part.indices[i]!),
      w(part.indices[i + 1]!),
      w(part.indices[i + 2]!),
    ]);
  }
  const creases: [V, V][] = [];
  for (let i = 0; i < part.lines.length; i += 6) {
    const a = new Vector3(
      part.lines[i]!,
      part.lines[i + 1]!,
      part.lines[i + 2]!,
    )
      .applyQuaternion(quat)
      .add(off);
    const b = new Vector3(
      part.lines[i + 3]!,
      part.lines[i + 4]!,
      part.lines[i + 5]!,
    )
      .applyQuaternion(quat)
      .add(off);
    creases.push([
      [a.x, a.y, a.z],
      [b.x, b.y, b.z],
    ]);
  }
  return { tris, creases, structural: true };
}

const key = (v: V) =>
  `${Math.round(v[0] * 1e5)},${Math.round(v[1] * 1e5)},${Math.round(v[2] * 1e5)}`;

/** Silhouette edges of a triangle soup as seen from the camera. */
function silhouette(tris: V[][]): [V, V][] {
  const edges = new Map<string, { a: V; b: V; front: number; total: number }>();
  for (const t of tris) {
    const n = cross(sub(t[1]!, t[0]!), sub(t[2]!, t[0]!));
    if (len(n) < 1e-12) continue; // degenerate (sphere poles)
    const c: V = [
      (t[0]![0] + t[1]![0] + t[2]![0]) / 3,
      (t[0]![1] + t[1]![1] + t[2]![1]) / 3,
      (t[0]![2] + t[1]![2] + t[2]![2]) / 3,
    ];
    const front = dot(n, sub(camPos, c)) > 0 ? 1 : 0;
    for (let i = 0; i < 3; i++) {
      const a = t[i]!;
      const b = t[(i + 1) % 3]!;
      const ka = key(a);
      const kb = key(b);
      const k = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const e = edges.get(k);
      if (e) {
        e.front += front;
        e.total += 1;
      } else edges.set(k, { a, b, front, total: 1 });
    }
  }
  const out: [V, V][] = [];
  for (const e of edges.values()) {
    if (e.front > 0 && e.front < e.total) out.push([e.a, e.b]);
    else if (e.total === 1 && e.front === 1) out.push([e.a, e.b]);
  }
  return out;
}

/** True if a triangle blocks the view from the camera to point `p`. */
function occluded(p: V, occluders: V[][]): boolean {
  const dir = sub(p, camPos);
  const dist = len(dir);
  const d: V = [dir[0] / dist, dir[1] / dist, dir[2] / dist];
  for (const t of occluders) {
    const e1 = sub(t[1]!, t[0]!);
    const e2 = sub(t[2]!, t[0]!);
    const h = cross(d, e2);
    const a = dot(e1, h);
    if (Math.abs(a) < 1e-12) continue;
    const f = 1 / a;
    const s = sub(camPos, t[0]!);
    const u = f * dot(s, h);
    if (u < 0 || u > 1) continue;
    const qv = cross(s, e1);
    const v = f * dot(d, qv);
    if (v < 0 || u + v > 1) continue;
    const tt = f * dot(e2, qv);
    if (tt > heroCamera.near && tt < dist - EPS_HIT) return true;
  }
  return false;
}

function visibleAt(p: V, occluders: V[][]): boolean {
  const toCam = sub(camPos, p);
  const l = len(toCam);
  const lifted: V = [
    p[0] + (toCam[0] / l) * EPS_LIFT,
    p[1] + (toCam[1] / l) * EPS_LIFT,
    p[2] + (toCam[2] / l) * EPS_LIFT,
  ];
  return !occluded(lifted, occluders);
}

/** Visible sub-segments of a 3D segment. */
function visibleParts(a: V, b: V, occluders: V[][]): [V, V][] {
  const L = len(sub(b, a));
  if (L < 1e-6) return [];
  const n = Math.min(64, Math.max(2, Math.ceil(L / 0.01)));
  const vis: boolean[] = [];
  for (let i = 0; i <= n; i++)
    vis.push(visibleAt(lerp(a, b, i / n), occluders));
  const refine = (t0: number, t1: number, v0: boolean): number => {
    let lo = t0;
    let hi = t1;
    for (let k = 0; k < 7; k++) {
      const mid = (lo + hi) / 2;
      if (visibleAt(lerp(a, b, mid), occluders) === v0) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const out: [V, V][] = [];
  let start: number | null = vis[0] ? 0 : null;
  for (let i = 1; i <= n; i++) {
    if (vis[i] === vis[i - 1]) continue;
    const t = refine((i - 1) / n, i / n, vis[i - 1]!);
    if (vis[i - 1]) {
      out.push([lerp(a, b, start!), lerp(a, b, t)]);
      start = null;
    } else start = t;
  }
  if (start !== null) out.push([lerp(a, b, start), b]);
  return out;
}

type P2 = [number, number];
const project = (v: V): P2 => {
  const p = new Vector3(...v).applyMatrix4(viewProj);
  const r = (n: number) => {
    const k = 10 ** PRECISION;
    return Math.round(n * k) / k + 0;
  };
  return [
    r(((p.x + 1) / 2) * posterViewBox.width),
    r(((1 - p.y) / 2) * posterViewBox.height),
  ];
};

/** Join 2D segments that share endpoints into polylines, then emit a path `d`. */
function toPath(segs: [P2, P2][]): string {
  const k = (p: P2) => `${p[0]},${p[1]}`;
  const seen = new Set<string>();
  const list: [P2, P2][] = [];
  for (const s of segs) {
    if (k(s[0]) === k(s[1])) continue;
    const a = k(s[0]);
    const b = k(s[1]);
    const id = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(id)) continue;
    seen.add(id);
    list.push(s);
  }
  const at = new Map<string, number[]>();
  list.forEach((s, i) => {
    for (const p of s) {
      const arr = at.get(k(p)) ?? [];
      arr.push(i);
      at.set(k(p), arr);
    }
  });
  const used = new Array<boolean>(list.length).fill(false);
  const ends = (i: number) => list[i]!;
  const next = (p: P2): number | undefined =>
    (at.get(k(p)) ?? []).find((i) => !used[i]);
  const fmt = (n: number) => String(n);
  const parts: string[] = [];
  for (let i = 0; i < list.length; i++) {
    if (used[i]) continue;
    used[i] = true;
    const chain: P2[] = [ends(i)[0], ends(i)[1]];
    for (;;) {
      const j = next(chain[chain.length - 1]!);
      if (j === undefined) break;
      used[j] = true;
      const [a, b] = ends(j);
      chain.push(k(a) === k(chain[chain.length - 1]!) ? b : a);
    }
    for (;;) {
      const j = next(chain[0]!);
      if (j === undefined) break;
      used[j] = true;
      const [a, b] = ends(j);
      chain.unshift(k(a) === k(chain[0]!) ? b : a);
    }
    parts.push('M' + chain.map((p) => `${fmt(p[0])} ${fmt(p[1])}`).join('L'));
  }
  return parts.join('');
}

export interface PosterOptions {
  /** Include unconfirmed objects (owner preview). Default false: what ships by default. */
  includeUnconfirmed?: boolean;
}

export function buildPoster(opts: PosterOptions = {}): string {
  const byFile = new Map<string, ModelDef>(models.map((m) => [m.file, m]));
  const placed: Placed[] = [];
  const sheetDef = byFile.get('sheet')!;
  const sheet = place(sheetDef.buildPosed(), [0, 0, 0], [0, 0, 0, 1]);
  placed.push(sheet);
  for (const o of objects) {
    if (!o.confirmed && !opts.includeUnconfirmed) continue;
    const def = byFile.get(o.model.replace(/\.glb$/, ''));
    if (!def) throw new Error(`poster: no model for ${o.id}`);
    placed.push(
      place(
        def.buildPosed(),
        o.home.p as V,
        o.home.q as [number, number, number, number],
      ),
    );
  }
  const occluders = placed.slice(1).flatMap((p) => p.tris);

  const structural: [P2, P2][] = [];
  const secondary: [P2, P2][] = [];
  const add = (target: [P2, P2][], a: V, b: V) => {
    for (const [va, vb] of visibleParts(a, b, occluders)) {
      const pa = project(va);
      const pb = project(vb);
      if (Math.hypot(pa[0] - pb[0], pa[1] - pb[1]) >= 0.3)
        target.push([pa, pb]);
    }
  };
  placed.forEach((pl, i) => {
    const seenWorld = new Set<string>();
    const dedupe = (a: V, b: V) => {
      const ka = key(a);
      const kb = key(b);
      const id = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      if (seenWorld.has(id)) return false;
      seenWorld.add(id);
      return true;
    };
    const target = i === 0 ? secondary : structural;
    for (const [a, b] of pl.creases) if (dedupe(a, b)) add(target, a, b);
    for (const [a, b] of silhouette(pl.tris))
      if (dedupe(a, b)) add(i === 0 ? structural : structural, a, b);
  });

  const { width: W, height: H } = posterViewBox;
  const attrs =
    'fill="none" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"';
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">` +
    `<path d="${toPath(secondary)}" stroke="#ded9fa" stroke-width="1" ${attrs}/>` +
    `<path d="${toPath(structural)}" stroke="#fff" stroke-width="1.5" ${attrs}/>` +
    `</svg>`;
  const out = optimize(svg, {
    multipass: true,
    floatPrecision: 2,
    plugins: ['preset-default', 'removeDimensions'],
  }).data;
  if (/NaN|Infinity/.test(out))
    throw new Error('poster: non-finite coordinate');
  return `${out}\n`;
}
