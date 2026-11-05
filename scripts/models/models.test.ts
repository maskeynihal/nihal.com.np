// @vitest-environment node
import { NodeIO } from '@gltf-transform/core';
import {
  EXTMeshoptCompression,
  KHRMeshQuantization,
} from '@gltf-transform/extensions';
import { MeshoptDecoder } from 'meshoptimizer';
import { Matrix4, Vector3 } from 'three';
import { beforeAll, describe, expect, it } from 'vitest';
import { objects } from '../../src/content/objects';
import { buildAssets, type BuiltAssets } from './build';
import { bounds } from './geom';
import { models } from './models';

let built: BuiltAssets;
beforeAll(async () => {
  built = await buildAssets();
});

const io = () =>
  new NodeIO()
    .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
    .registerDependencies({ 'meshopt.decoder': MeshoptDecoder });

describe('asset pipeline', () => {
  it('is byte-identical across runs', async () => {
    const again = await buildAssets();
    expect(again.linesJson).toBe(built.linesJson);
    for (const [name, bytes] of built.glbs) {
      expect(
        Buffer.from(again.glbs.get(name)!).equals(Buffer.from(bytes)),
      ).toBe(true);
    }
  });

  it('emits a GLB for every model referenced by objects.ts, plus the sheet', () => {
    expect(built.glbs.has('sheet.glb')).toBe(true);
    for (const o of objects) expect(built.glbs.has(o.model), o.id).toBe(true);
  });

  it('keeps grey-box objects at 300 triangles or fewer', () => {
    for (const s of built.stats)
      expect(s.tris, s.file).toBeLessThanOrEqual(300);
  });

  it('each GLB has a triangle primitive and a LINES primitive that match the line data', async () => {
    await MeshoptDecoder.ready;
    const lines = JSON.parse(built.linesJson) as Record<string, number[]>;
    for (const m of models) {
      const doc = await io().readBinary(built.glbs.get(`${m.file}.glb`)!);
      const prims = doc.getRoot().listMeshes()[0]!.listPrimitives();
      const tri = prims.find((p) => p.getMode() === 4);
      const ln = prims.find((p) => p.getMode() === 1);
      expect(tri, m.file).toBeDefined();
      expect(ln, m.file).toBeDefined();
      // decoded (quantized) lines land back on the authored data in world space
      const node = doc.getRoot().listNodes()[0]!;
      const mat = new Matrix4().fromArray(node.getWorldMatrix());
      const pos = ln!.getAttribute('POSITION')!;
      const src = lines[m.file]!;
      expect(pos.getCount() * 3).toBe(src.length);
      const v = new Vector3();
      for (let i = 0; i < pos.getCount(); i++) {
        const e = pos.getElement(i, [0, 0, 0]);
        v.set(e[0]!, e[1]!, e[2]!).applyMatrix4(mat);
        expect(Math.abs(v.x - src[i * 3]!)).toBeLessThan(1e-3);
        expect(Math.abs(v.y - src[i * 3 + 1]!)).toBeLessThan(1e-3);
        expect(Math.abs(v.z - src[i * 3 + 2]!)).toBeLessThan(1e-3);
      }
    }
  });

  it('fits each object inside its collider, resting on y = 0', () => {
    const byFile = new Map(models.map((m) => [`${m.file}.glb`, m]));
    for (const o of objects) {
      const b = bounds(byFile.get(o.model)!.build());
      const [ox, oy, oz] = o.collider.offset ?? [0, 0, 0];
      const a = o.collider.args;
      const half =
        o.collider.kind === 'cuboid'
          ? [a[0]!, a[1]!, a[2]!]
          : [a[0]!, a[0]!, a[0]!];
      const tol = 1e-4;
      expect(b.min[1], o.id).toBeCloseTo(0, 4);
      expect(b.min[0]).toBeGreaterThanOrEqual(ox - half[0]! - tol);
      expect(b.max[0]).toBeLessThanOrEqual(ox + half[0]! + tol);
      expect(b.min[1]).toBeGreaterThanOrEqual(oy - half[1]! - tol);
      expect(b.max[1]).toBeLessThanOrEqual(oy + half[1]! + tol);
      expect(b.min[2]).toBeGreaterThanOrEqual(oz - half[2]! - tol);
      expect(b.max[2]).toBeLessThanOrEqual(oz + half[2]! + tol);
    }
  });
});
