/**
 * GLB writer (D-06). Builds the glTF document directly with @gltf-transform/core (no
 * GLTFExporter, so no Blob/FileReader shims and byte-identical output), then meshopt-compresses.
 * Each object GLB holds one mesh with two primitives: triangles (occluder + inverted hull)
 * and `LINES` (authored creases, mode 1).
 */
import { Document, Logger, NodeIO } from '@gltf-transform/core';
import {
  EXTMeshoptCompression,
  KHRMeshQuantization,
} from '@gltf-transform/extensions';
import { meshopt } from '@gltf-transform/functions';
import { MeshoptEncoder } from 'meshoptimizer';
import type { Part } from './geom';

const MODE_LINES = 1;

export async function partToGlb(name: string, part: Part): Promise<Uint8Array> {
  await MeshoptEncoder.ready;
  const doc = new Document().setLogger(new Logger(Logger.Verbosity.WARN));
  doc.createExtension(EXTMeshoptCompression).setRequired(true);
  doc.getRoot().getAsset().generator = 'nihal-com-np scripts/models';
  const buffer = doc.createBuffer();

  const f32 = (a: number[]) => new Float32Array(a);
  const accessor = (data: Float32Array<ArrayBuffer>, type: 'VEC3') =>
    doc.createAccessor().setType(type).setArray(data).setBuffer(buffer);

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

  const lines = doc
    .createPrimitive()
    .setExtras({ role: 'LINES' }) // glTF primitives carry no name; mode 1 is the contract
    .setMode(MODE_LINES)
    .setAttribute('POSITION', accessor(f32(part.lines), 'VEC3'));

  const mesh = doc.createMesh(name).addPrimitive(tris).addPrimitive(lines);
  const node = doc.createNode(name).setMesh(mesh);
  doc.createScene(name).addChild(node);

  await doc.transform(meshopt({ encoder: MeshoptEncoder, level: 'high' }));
  const io = new NodeIO()
    .setLogger(new Logger(Logger.Verbosity.WARN))
    .registerExtensions([EXTMeshoptCompression, KHRMeshQuantization])
    .registerDependencies({
      'meshopt.encoder': MeshoptEncoder,
    });
  return io.writeBinary(doc);
}
