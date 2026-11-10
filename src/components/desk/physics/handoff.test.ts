import { describe, expect, it } from 'vitest';
import {
  BufferGeometry,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Vector3,
} from 'three';
import { screenRect } from './handoff';

const flat = (p: Vector3) => ({ x: p.x * 100, y: -p.y * 100 });

describe('screenRect', () => {
  it('measures a line-art stroke by its ends, not by its unit quad template', () => {
    // Line-art strokes are instanced quads: `position` is a template of corners at +-1 and the
    // real ends are the instance attributes.
    const g = new BufferGeometry();
    g.setAttribute(
      'position',
      new Float32BufferAttribute([-1, 2, 0, 1, 2, 0, -1, 1, 0, 1, 1, 0], 3),
    );
    g.setAttribute(
      'instanceStart',
      new InstancedBufferAttribute(new Float32Array([0, 0, 0]), 3),
    );
    g.setAttribute(
      'instanceEnd',
      new InstancedBufferAttribute(new Float32Array([0.5, 0.25, 0]), 3),
    );
    const root = new Object3D();
    root.add(new Mesh(g, new MeshBasicMaterial()));
    const r = screenRect(root, flat);
    expect(r.w).toBeCloseTo(50, 6);
    expect(r.h).toBeCloseTo(25, 6);
  });

  it('measures a plain mesh by its vertices and skips hulls', () => {
    const g = new BufferGeometry();
    g.setAttribute(
      'position',
      new Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3),
    );
    const root = new Object3D();
    root.add(new Mesh(g, new MeshBasicMaterial()));
    const hull = new Mesh(
      new BufferGeometry().setAttribute(
        'position',
        new Float32BufferAttribute([-9, -9, 0, 9, 9, 0], 3),
      ),
      new MeshBasicMaterial(),
    );
    hull.name = 'x-hull';
    root.add(hull);
    const r = screenRect(root, flat);
    expect(r.w).toBeCloseTo(100, 6);
    expect(r.h).toBeCloseTo(100, 6);
  });
});
