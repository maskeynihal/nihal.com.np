/**
 * GLB writer (D-06). Builds the glTF document directly with @gltf-transform/core (no
 * GLTFExporter, so no Blob/FileReader shims and byte-identical output), then meshopt-compresses.
 * Scene > root node (identity) > `body` (mesh) plus one pivot node per named part. Every mesh has a
 * triangle primitive (occluder + inverted hull) and, when it has creases, a `LINES` primitive (mode 1).
 */
import { Document, Logger, NodeIO } from '@gltf-transform/core';
import {
  EXTMeshoptCompression,
  KHRMeshQuantization,
} from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import type { Part } from './geom';
import type { ModelParts } from './models';

const MODE_LINES = 1;

/**
 * The JSON chunk is more than half of a small GLB: float32 numbers are written with their full
 * double expansion (`0.20999999344348907` for 0.21). Rewrite the chunk with 8 significant digits
 * (the same float32 when read back) and without the generator string, and keep the layout valid.
 */
function slimJson(glb: Uint8Array): Uint8Array {
  const view = new DataView(glb.buffer, glb.byteOffset, glb.byteLength);
  const jsonLen = view.getUint32(12, true);
  const json = JSON.parse(
    new TextDecoder().decode(glb.subarray(20, 20 + jsonLen)),
  ) as Record<string, unknown>;
  const round = (v: unknown): unknown => {
    if (typeof v === 'number')
      return Number.isInteger(v) ? v : Number(v.toPrecision(8));
    if (Array.isArray(v)) return v.map(round);
    if (v && typeof v === 'object')
      return Object.fromEntries(
        Object.entries(v).map(([k, x]) => [k, round(x)]),
      );
    return v;
  };
  const slim = round(json) as {
    asset?: { generator?: string };
    accessors?: { normalized?: boolean; byteOffset?: number }[];
    bufferViews?: {
      byteOffset?: number;
      extensions?: { EXT_meshopt_compression?: { byteOffset?: number } };
    }[];
    meshes?: { primitives?: { mode?: number; extras?: unknown }[] }[];
  };
  if (slim.asset) delete slim.asset.generator;
  // spec defaults need not be written
  for (const a of slim.accessors ?? []) {
    if (a.normalized === false) delete a.normalized;
    if (a.byteOffset === 0) delete a.byteOffset;
  }
  for (const b of slim.bufferViews ?? []) {
    if (b.byteOffset === 0) delete b.byteOffset;
    const m = b.extensions?.EXT_meshopt_compression;
    if (m?.byteOffset === 0) delete m.byteOffset;
  }
  for (const m of slim.meshes ?? [])
    for (const p of m.primitives ?? []) {
      if (p.mode === 4) delete p.mode;
      delete p.extras;
    }
  const text = new TextEncoder().encode(JSON.stringify(slim));
  const padded = Math.ceil(text.length / 4) * 4;
  const rest = glb.subarray(20 + jsonLen);
  const out = new Uint8Array(20 + padded + rest.length);
  out.set(glb.subarray(0, 20));
  out.fill(0x20, 20, 20 + padded);
  out.set(text, 20);
  out.set(rest, 20 + padded);
  const dv = new DataView(out.buffer);
  dv.setUint32(8, out.length, true);
  dv.setUint32(12, padded, true);
  return out;
}

export async function modelToGlb(
  name: string,
  mp: ModelParts,
): Promise<Uint8Array> {
  await MeshoptEncoder.ready;
  const doc = new Document().setLogger(new Logger(Logger.Verbosity.WARN));
  doc.createExtension(EXTMeshoptCompression).setRequired(true);
  doc.getRoot().getAsset().generator = 'nihal-com-np scripts/models';
  const buffer = doc.createBuffer();

  const f32 = (a: number[]) => new Float32Array(a);
  const accessor = (data: Float32Array<ArrayBuffer>, type: 'VEC3' | 'VEC2') =>
    doc.createAccessor().setType(type).setArray(data).setBuffer(buffer);

  const meshOf = (meshName: string, part: Part) => {
    const tris = doc
      .createPrimitive()
      .setAttribute('POSITION', accessor(f32(part.positions), 'VEC3'))
      .setAttribute('NORMAL', accessor(f32(part.normals), 'VEC3'))
      .setIndices(
        doc
          .createAccessor()
          .setType('SCALAR')
          .setArray(new Uint16Array(part.indices))
          .setBuffer(buffer),
      );
    if (part.uvs)
      tris.setAttribute('TEXCOORD_0', accessor(f32(part.uvs), 'VEC2'));
    const mesh = doc.createMesh(meshName).addPrimitive(tris);
    if (part.lines.length > 0) {
      mesh.addPrimitive(
        doc
          .createPrimitive()
          .setExtras({ role: 'LINES' }) // glTF primitives carry no name; mode 1 is the contract
          .setMode(MODE_LINES)
          .setAttribute('POSITION', accessor(f32(part.lines), 'VEC3')),
      );
    }
    return mesh;
  };

  // root (identity) -> `body` mesh node + one pivot node per named part. The pivot has no mesh,
  // so quantization never touches its transform; its child `<name>-mesh` carries the geometry.
  const root = doc.createNode(name);
  root.addChild(
    doc.createNode('body').setMesh(meshOf(`${name}-body`, mp.body)),
  );
  for (const n of mp.nodes) {
    if (n.posterOnly) continue;
    const pivot = doc.createNode(n.name).setTranslation(n.origin);
    pivot.addChild(
      doc
        .createNode(`${n.name}-mesh`)
        .setMesh(meshOf(`${name}-${n.name}`, n.part)),
    );
    root.addChild(pivot);
  }
  doc.createScene(name).addChild(root);

  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  const io = new NodeIO()
    .setLogger(new Logger(Logger.Verbosity.WARN))
    .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
    .registerDependencies({
      'meshopt.encoder': MeshoptEncoder,
    });
  return slimJson(await io.writeBinary(doc));
}
