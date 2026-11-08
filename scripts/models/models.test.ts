// @vitest-environment node
import { NodeIO, type Node } from '@gltf-transform/core';
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

  it('emits a GLB for every model referenced by objects.ts, plus the sheet and the table', () => {
    expect(built.glbs.has('sheet.glb')).toBe(true);
    expect(built.glbs.has('table.glb')).toBe(true);
    for (const o of objects) expect(built.glbs.has(o.model), o.id).toBe(true);
  });

  it('keeps every model within its triangle, total and byte budgets', () => {
    for (const s of built.stats)
      expect(s.tris, s.file).toBeLessThanOrEqual(1200);
    // the sheet and the table are the furniture, not objects: the triangle budget counts the objects
    const objs = built.stats.filter(
      (s) => s.file !== 'sheet.glb' && s.file !== 'table.glb',
    );
    expect(objs.reduce((n, s) => n + s.tris, 0)).toBeLessThanOrEqual(8000);
    expect(built.stats.reduce((n, s) => n + s.bytes, 0)).toBeLessThanOrEqual(
      150 * 1024,
    );
  });

  it('winds every triangle to agree with its normals', () => {
    for (const m of models) {
      const p = m.build();
      const v = (k: number) =>
        new Vector3(
          p.positions[k * 3]!,
          p.positions[k * 3 + 1]!,
          p.positions[k * 3 + 2]!,
        );
      const nv = (k: number) =>
        new Vector3(
          p.normals[k * 3]!,
          p.normals[k * 3 + 1]!,
          p.normals[k * 3 + 2]!,
        );
      let bad = 0;
      for (let i = 0; i < p.indices.length; i += 3) {
        const [a, b, c] = [p.indices[i]!, p.indices[i + 1]!, p.indices[i + 2]!];
        const n = v(b)
          .sub(v(a))
          .cross(v(c).sub(v(a)));
        if (n.lengthSq() < 1e-14) continue; // degenerate pole triangle
        if (n.dot(nv(a).add(nv(b)).add(nv(c))) <= 0) bad++;
      }
      expect(bad, m.file).toBe(0);
    }
  });

  it('exposes the named nodes the runtime needs, as pivots with a mesh child', async () => {
    await MeshoptDecoder.ready;
    const want: Record<string, string[]> = {
      clock: ['hand-hour', 'hand-minute'],
      calendar: ['face'],
      ghost: ['eye-l', 'eye-r'],
      arduino: ['screen'],
      cruiser: [],
      sheet: [],
      table: [],
    };
    for (const [file, names] of Object.entries(want)) {
      const doc = await io().readBinary(built.glbs.get(`${file}.glb`)!);
      const root = doc.getRoot().listScenes()[0]!.listChildren()[0]!;
      expect(root.getName(), file).toBe(file);
      expect(root.getMesh(), file).toBeNull();
      expect(
        root.listChildren().map((n) => n.getName()),
        file,
      ).toEqual(['body', ...names]);
      for (const n of root.listChildren().slice(1)) {
        // pivot: no mesh of its own, so rotating it never fights quantization
        expect(n.getMesh(), n.getName()).toBeNull();
        expect(n.listChildren().map((c) => c.getName())).toEqual([
          `${n.getName()}-mesh`,
        ]);
      }
    }
    const clock = await io().readBinary(built.glbs.get('clock.glb')!);
    for (const n of ['hand-hour', 'hand-minute']) {
      const node = clock
        .getRoot()
        .listNodes()
        .find((x) => x.getName() === n)!;
      const t = node.getTranslation();
      expect(t[0]).toBeCloseTo(0, 5);
      expect(t[2]).toBeCloseTo(0, 5);
      expect(node.getRotation()).toEqual([0, 0, 0, 1]);
    }
    for (const [file, n] of [
      ['calendar', 'face-mesh'],
      ['arduino', 'screen-mesh'],
    ] as const) {
      const doc = await io().readBinary(built.glbs.get(`${file}.glb`)!);
      const node = doc
        .getRoot()
        .listNodes()
        .find((x) => x.getName() === n)!;
      expect(
        node.getMesh()!.listPrimitives()[0]!.getAttribute('TEXCOORD_0'),
        file,
      ).not.toBeNull();
    }
  });

  it('each GLB has triangle and LINES primitives that match the line data', async () => {
    await MeshoptDecoder.ready;
    const lines = JSON.parse(built.linesJson) as Record<string, number[]>;
    for (const m of models) {
      const doc = await io().readBinary(built.glbs.get(`${m.file}.glb`)!);
      const src = lines[m.file]!;
      // meshes in scene order: body first, then each named node (rest pose, identity rotation)
      const meshNodes: Node[] = [];
      doc
        .getRoot()
        .listScenes()[0]!
        .traverse((n) => {
          if (n.getMesh()) meshNodes.push(n);
        });
      let at = 0;
      const v = new Vector3();
      for (const node of meshNodes) {
        const prims = node.getMesh()!.listPrimitives();
        expect(
          prims.find((p) => p.getMode() === 4),
          `${m.file}/${node.getName()}`,
        ).toBeDefined();
        const ln = prims.find((p) => p.getMode() === 1);
        if (!ln) continue;
        const mat = new Matrix4().fromArray(node.getWorldMatrix());
        const pos = ln.getAttribute('POSITION')!;
        for (let i = 0; i < pos.getCount(); i++) {
          const e = pos.getElement(i, [0, 0, 0]);
          v.set(e[0]!, e[1]!, e[2]!).applyMatrix4(mat);
          expect(Math.abs(v.x - src[at]!)).toBeLessThan(1e-3);
          expect(Math.abs(v.y - src[at + 1]!)).toBeLessThan(1e-3);
          expect(Math.abs(v.z - src[at + 2]!)).toBeLessThan(1e-3);
          at += 3;
        }
      }
      expect(at, m.file).toBe(src.length);
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
