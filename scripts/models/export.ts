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
  return io.writeBinary(doc);
}
