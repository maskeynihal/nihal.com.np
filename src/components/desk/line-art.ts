import {
  BackSide,
  Color,
  Group,
  Mesh,
  MeshBasicMaterial,
  ShaderMaterial,
  Vector2,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import { readToken } from '../../lib/desk/tokens';

/**
 * The line-art look (design 4.2), three passes per object, no lights:
 *  1. occluder: the blue fill, pushed back a little so lines sit cleanly on it;
 *  2. silhouette: the same geometry, back faces only, pushed out along the normal by a constant
 *     number of screen pixels (inverted hull), so curved surfaces get an outline;
 *  3. creases: the authored LINES primitive from the GLB drawn as thick `LineSegments2`.
 * One material of each kind is shared by every object, so resizing updates one uniform.
 */
export const LINE_PX = 1.5;
export const SECONDARY_LINE_PX = 1;

export interface LineArt {
  occluder: MeshBasicMaterial;
  hull: ShaderMaterial;
  line: LineMaterial;
  /** The sheet border: --line-2, 1 px. */
  lineSecondary: LineMaterial;
  blue: Color;
  /** Pass the canvas size in CSS px (the unit LINE_PX is in). */
  setResolution(width: number, height: number): void;
  dispose(): void;
}

const HULL_VERTEX = /* glsl */ `
  uniform float uPx;
  uniform float uResY;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vec3 n = normalize(normalMatrix * normal);
    // View-space size of one pixel at this depth, so the outline is the same width on every
    // mesh whatever its node scale.
    float perPx = 2.0 * -mv.z / (projectionMatrix[1][1] * uResY);
    mv.xyz += n * perPx * uPx;
    gl_Position = projectionMatrix * mv;
  }
`;
const HULL_FRAGMENT = /* glsl */ `
  uniform vec3 uColor;
  void main() { gl_FragColor = vec4(uColor, 1.0); }
`;

export function createLineArt(): LineArt {
  const blue = new Color(readToken('--blue'));
  const white = new Color(readToken('--white'));
  const occluder = new MeshBasicMaterial({
    color: blue,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
    toneMapped: false,
  });
  const hull = new ShaderMaterial({
    side: BackSide,
    toneMapped: false,
    uniforms: {
      uPx: { value: LINE_PX },
      uResY: { value: 1 },
      uColor: { value: white },
    },
    vertexShader: HULL_VERTEX,
    fragmentShader: HULL_FRAGMENT,
  });
  const make = (color: Color, linewidth: number) => {
    const m = new LineMaterial({
      color: color.getHex(),
      linewidth,
      worldUnits: false,
      alphaToCoverage: true,
      toneMapped: false,
    });
    m.resolution.set(1, 1);
    return m;
  };
  const line = make(white, LINE_PX);
  const lineSecondary = make(
    new Color(readToken('--line-2')),
    SECONDARY_LINE_PX,
  );
  return {
    occluder,
    hull,
    line,
    lineSecondary,
    blue,
    setResolution(width, height) {
      const r = new Vector2(width, height);
      line.resolution.copy(r);
      lineSecondary.resolution.copy(r);
      (hull.uniforms['uResY'] as { value: number }).value = height;
    },
    dispose() {
      for (const m of [occluder, hull, line, lineSecondary]) m.dispose();
    },
  };
}

const noRaycast = () => {};

/** Positions of a LINES primitive as plain floats: quantized (normalized Int16) data read raw would be garbage. */
function linePositions(geometry: BufferGeometry): Float32Array {
  const pos = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const count = index ? index.count : pos.count;
  const out = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const v = index ? index.getX(i) : i;
    out[i * 3] = pos.getX(v);
    out[i * 3 + 1] = pos.getY(v);
    out[i * 3 + 2] = pos.getZ(v);
  }
  return out;
}

/**
 * Edges used by exactly one triangle: the outline of an open surface. A flat sheet has no back
 * faces, so the inverted hull draws nothing for it; its outer edge is drawn from these instead
 * (the poster draws the same edge from the same triangles).
 */
export function boundaryEdges(geometry: BufferGeometry): Float32Array {
  const pos = geometry.getAttribute('position');
  const index = geometry.getIndex();
  const count = index ? index.count : pos.count;
  const keyOf = (v: number) => `${pos.getX(v)},${pos.getY(v)},${pos.getZ(v)}`;
  const edges = new Map<string, { a: number; b: number; n: number }>();
  for (let t = 0; t + 2 < count; t += 3) {
    const tri = [0, 1, 2].map((k) => (index ? index.getX(t + k) : t + k));
    for (let k = 0; k < 3; k++) {
      const a = tri[k]!;
      const b = tri[(k + 1) % 3]!;
      const ka = keyOf(a);
      const kb = keyOf(b);
      const key = ka < kb ? `${ka}|${kb}` : `${kb}|${ka}`;
      const e = edges.get(key);
      if (e) e.n += 1;
      else edges.set(key, { a, b, n: 1 });
    }
  }
  const out: number[] = [];
  for (const e of edges.values()) {
    if (e.n !== 1) continue;
    for (const v of [e.a, e.b]) out.push(pos.getX(v), pos.getY(v), pos.getZ(v));
  }
  return new Float32Array(out);
}

export interface PrepareOptions {
  /** Material per mesh node name (for example `screen-mesh`): textured quads skip the hull. */
  textured?: Record<string, Material> | undefined;
  /** The sheet draws its border in the secondary line style (its silhouette is still the white outer edge). */
  sheet?: boolean;
}

/**
 * Turns a cloned GLB scene into line art in place: occluder + hull on every triangle mesh, and
 * every LINES primitive swapped for a `LineSegments2` parented where the original was, so the
 * node's own translate/scale (meshopt quantization) still applies. Returns the pickable meshes.
 */
export function prepareLineArt(
  root: Object3D,
  art: LineArt,
  options: PrepareOptions = {},
): Mesh[] {
  const meshes: Mesh[] = [];
  const lines: Object3D[] = [];
  root.traverse((o) => {
    if ((o as Mesh).isMesh) meshes.push(o as Mesh);
    else if ((o as { isLineSegments?: boolean }).isLineSegments) lines.push(o);
  });

  for (const mesh of meshes) {
    const textured = options.textured?.[mesh.name];
    mesh.material = textured ?? art.occluder;
    if (textured) continue;
    if (options.sheet) {
      const outline = new LineSegments2(
        new LineSegmentsGeometry().setPositions(boundaryEdges(mesh.geometry)),
        art.line,
      );
      outline.name = `${mesh.name}-outline`;
      outline.raycast = noRaycast;
      mesh.add(outline);
      continue;
    }
    const hull = new Mesh(mesh.geometry, art.hull);
    hull.name = `${mesh.name}-hull`;
    hull.raycast = noRaycast;
    mesh.add(hull);
  }

  for (const original of lines) {
    const parent = original.parent;
    if (!parent) continue;
    const geometry = new LineSegmentsGeometry();
    geometry.setPositions(
      linePositions((original as unknown as Mesh).geometry),
    );
    const ls = new LineSegments2(
      geometry,
      options.sheet ? art.lineSecondary : art.line,
    );
    ls.name = `${original.name}-lines`;
    ls.position.copy(original.position);
    ls.quaternion.copy(original.quaternion);
    ls.scale.copy(original.scale);
    ls.raycast = noRaycast;
    parent.add(ls);
    parent.remove(original);
    (original as unknown as Mesh).geometry.dispose();
  }
  return meshes;
}

/** A unit-radius-sphere probe for the outline test (test hook only). */
export function sphereProbe(art: LineArt, geometry: BufferGeometry): Group {
  const g = new Group();
  const m = new Mesh(geometry, art.occluder);
  const h = new Mesh(geometry, art.hull);
  h.raycast = noRaycast;
  g.add(m, h);
  return g;
}
