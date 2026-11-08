// @vitest-environment node
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Box3, Mesh, Raycaster, Vector3, type Object3D } from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { describe, expect, it } from 'vitest';
import { createLineArt, prepareLineArt } from './line-art';

const modelsDir = resolve(import.meta.dirname, '../../assets/models');

async function load(name: string): Promise<Object3D> {
  const bytes = readFileSync(resolve(modelsDir, `${name}.glb`));
  const buffer = bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  );
  await MeshoptDecoder.ready;
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const gltf = await loader.parseAsync(buffer as ArrayBuffer, '');
  return gltf.scene;
}

/** Authored creases (lines.json, unquantized, local metres) as a box. */
function authoredBox(file: string): Box3 {
  const all = JSON.parse(
    readFileSync(resolve(modelsDir, 'lines.json'), 'utf8'),
  ) as Record<string, number[]>;
  const a = all[file] ?? [];
  const box = new Box3();
  for (let i = 0; i < a.length; i += 3)
    box.expandByPoint(new Vector3(a[i], a[i + 1], a[i + 2]));
  return box;
}

describe('prepareLineArt', () => {
  it('swaps every LINES primitive for a LineSegments2 that keeps the authored positions', async () => {
    const art = createLineArt();
    const root = await load('arduino');
    prepareLineArt(root, art, {});
    root.updateMatrixWorld(true);
    const lines: LineSegments2[] = [];
    root.traverse((o) => {
      if (o instanceof LineSegments2) lines.push(o);
      // The loader's plain LineSegments must be gone.
      expect((o as { isLineSegments?: boolean }).isLineSegments).not.toBe(true);
    });
    expect(lines.length).toBeGreaterThan(0);
    // Quantized positions are restored by the node transform: the world box of the creases
    // equals the authored one to within the 16-bit quantization step.
    const box = new Box3();
    for (const l of lines) {
      const g = l.geometry;
      const start = g.getAttribute('instanceStart');
      const end = g.getAttribute('instanceEnd');
      for (let i = 0; i < start.count; i++) {
        for (const a of [start, end]) {
          const p = new Vector3(a.getX(i), a.getY(i), a.getZ(i)).applyMatrix4(
            l.matrixWorld,
          );
          box.expandByPoint(p);
        }
      }
    }
    const want = authoredBox('arduino');
    const eps = 0.002;
    for (const k of ['x', 'y', 'z'] as const) {
      expect(Math.abs(box.min[k] - want.min[k])).toBeLessThan(eps);
      expect(Math.abs(box.max[k] - want.max[k])).toBeLessThan(eps);
    }
    art.dispose();
  });

  it('lines and hulls are not raycastable; occluders are', async () => {
    const art = createLineArt();
    const root = await load('clock');
    const pickable = prepareLineArt(root, art, {});
    expect(pickable.length).toBeGreaterThan(0);
    root.updateMatrixWorld(true);
    const ray = new Raycaster(new Vector3(0, 1, 0), new Vector3(0, -1, 0));
    const hits = ray.intersectObject(root, true);
    expect(hits.length).toBeGreaterThan(0);
    for (const h of hits) {
      expect(h.object).toBeInstanceOf(Mesh);
      expect((h.object as Mesh).material).toBe(art.occluder);
    }
    root.traverse((o) => {
      if (o instanceof LineSegments2 || o.name.endsWith('-hull')) {
        const into: unknown[] = [];
        o.raycast(ray, into as never);
        expect(into).toHaveLength(0);
      }
    });
    art.dispose();
  });

  it('shares one occluder, one hull and one line material across every mesh', async () => {
    const art = createLineArt();
    const root = await load('clock');
    prepareLineArt(root, art, {});
    const occluders = new Set<unknown>();
    const hulls = new Set<unknown>();
    const lines = new Set<unknown>();
    root.traverse((o) => {
      const m = (o as Mesh).material;
      if (o instanceof LineSegments2) lines.add(m);
      else if (o.name.endsWith('-hull')) hulls.add(m);
      else if ((o as Mesh).isMesh) occluders.add(m);
    });
    expect([occluders.size, hulls.size, lines.size]).toEqual([1, 1, 1]);
    art.dispose();
  });

  it('leaves the pivot nodes alone so they can be rotated', async () => {
    const art = createLineArt();
    const root = await load('clock');
    prepareLineArt(root, art, {});
    const hand = root.getObjectByName('hand-hour');
    expect(hand).toBeDefined();
    expect((hand as Mesh).isMesh).toBeFalsy();
    expect(hand?.children.map((c) => c.name)).toContain('hand-hour-mesh');
    art.dispose();
  });
});

describe('the sheet', () => {
  it('has no hull (a flat sheet has no back faces) but draws its outer edge from its boundary edges', async () => {
    const art = createLineArt();
    const root = await load('sheet');
    prepareLineArt(root, art, { sheet: true });
    root.updateMatrixWorld(true);
    const outline: LineSegments2[] = [];
    let hulls = 0;
    root.traverse((o) => {
      if (o.name.endsWith('-outline') && o instanceof LineSegments2)
        outline.push(o);
      if (o.name.endsWith('-hull')) hulls++;
    });
    expect(hulls).toBe(0);
    expect(outline).toHaveLength(1);
    const g = outline[0]!.geometry;
    // The rounded-corner plane's boundary is a closed loop of edges (four sides and the corner arcs),
    // in white (the primary line material).
    expect(g.getAttribute('instanceStart').count).toBeGreaterThanOrEqual(4);
    expect(outline[0]!.material).toBe(art.line);
    // The border crease inside it is the secondary, thinner line.
    const border: LineSegments2[] = [];
    root.traverse((o) => {
      if (o instanceof LineSegments2 && o.material === art.lineSecondary)
        border.push(o);
    });
    expect(border.length).toBeGreaterThan(0);
    art.dispose();
  });
});

describe('createLineArt', () => {
  it('setResolution feeds both line materials and the hull in one call', () => {
    const art = createLineArt();
    art.setResolution(640, 480);
    expect(art.line.resolution.toArray()).toEqual([640, 480]);
    expect(art.lineSecondary.resolution.toArray()).toEqual([640, 480]);
    expect(art.hull.uniforms['uResY']?.value).toBe(480);
    art.setResolution(320, 200);
    expect(art.line.resolution.toArray()).toEqual([320, 200]);
    art.dispose();
  });

  it('draws lines at 1.5 px (1 px for the sheet border), alpha-to-coverage, no tone mapping', () => {
    const art = createLineArt();
    expect(art.line.linewidth).toBe(1.5);
    expect(art.lineSecondary.linewidth).toBe(1);
    expect(art.line.alphaToCoverage).toBe(true);
    expect(art.line.worldUnits).toBe(false);
    expect(art.line.toneMapped).toBe(false);
    expect(art.occluder.polygonOffset).toBe(true);
    expect(art.occluder.polygonOffsetFactor).toBe(1);
    expect(art.occluder.polygonOffsetUnits).toBe(1);
    art.dispose();
  });

  it('draws lines in the --stroke token and the occluder writes no colour', () => {
    const art = createLineArt();
    expect(art.line.color.getHexString()).toBe('ffffff');
    expect(art.occluder.colorWrite).toBe(false);
    art.dispose();
  });
});
