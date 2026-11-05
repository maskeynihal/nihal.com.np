import {
  Group,
  Vector3,
  type InterleavedBufferAttribute,
  type Scene,
} from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';
import type { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LEADER_MIN, offsetFor, stepFactor } from '../../lib/desk/explode';
import type { LineArt } from './line-art';
import { registry, type RegistryEntry } from './registry';

interface Leader {
  line: LineSegments2;
  material: LineMaterial;
}

const _base = new Vector3();
const _want = new Vector3();
const _up = new Vector3();

/**
 * The exploded view (design 4.4). Owns the shown factor and what it does to the scene:
 * each resting object is offset from where it rests by `factor * def.explode`, and a leader line
 * runs from the rest pose to the exploded pose. An object that is awake (held, thrown, still
 * moving) is skipped, and eases in from zero once it sleeps, so nothing pops.
 *
 * A plain class so the frame loop touches no React state.
 */
export class ExplodeView {
  target = 0;
  factor = 0;
  /** Current offset applied to each object (resting only). */
  private readonly offsets = new Map<string, Vector3>();
  /** Ids that were awake last frame and have not finished easing back in. */
  private readonly easing = new Set<string>();
  private readonly leaders = new Map<string, Leader>();
  private readonly group = new Group();

  constructor(
    private readonly scene: Scene,
    private readonly art: LineArt,
  ) {
    this.group.name = 'explode';
    scene.add(this.group);
  }

  setTarget(t: number): void {
    this.target = t;
  }

  /** The offset applied to an object right now, metres (zero while it is awake). */
  offsetOf(id: string): [number, number, number] {
    const o = this.offsets.get(id);
    return o ? [o.x, o.y, o.z] : [0, 0, 0];
  }

  leaderState(): { id: string; visible: boolean; opacity: number }[] {
    return [...this.leaders].map(([id, l]) => ({
      id,
      visible: l.line.visible,
      opacity: l.material.opacity,
    }));
  }

  /** One drawn frame. True while anything is still moving (the caller keeps rendering). */
  update(
    awake: (id: string) => boolean,
    size: { width: number; height: number },
  ): boolean {
    const step = stepFactor(this.factor, this.target);
    this.factor = step.value;
    let moving = !step.done;
    const live = new Set<string>();
    for (const entry of registry.all()) {
      live.add(entry.id);
      const off = this.offsets.get(entry.id) ?? new Vector3();
      this.offsets.set(entry.id, off);
      const leader = this.leaderFor(entry);
      if (awake(entry.id)) {
        off.set(0, 0, 0);
        this.easing.add(entry.id);
        leader.line.visible = false;
        continue;
      }
      _want.set(...offsetFor(entry.def.explode, this.factor));
      if (this.easing.has(entry.id)) {
        off.lerp(_want, 0.2);
        if (off.distanceTo(_want) < 1e-4) {
          off.copy(_want);
          this.easing.delete(entry.id);
        } else moving = true;
      } else off.copy(_want);
      this.place(entry, off, leader, size);
    }
    for (const id of [...this.leaders.keys()])
      if (!live.has(id)) this.dropLeader(id);
    return moving;
  }

  private place(
    entry: RegistryEntry,
    off: Vector3,
    leader: Leader,
    size: { width: number; height: number },
  ): void {
    const def = entry.def;
    // A body that has been moved rests somewhere else: offset from there.
    const rest = entry.bodyGroup ? entry.bodyGroup.position : null;
    if (rest) entry.obj.position.copy(off);
    else entry.obj.position.set(...def.p).add(off);
    // The leader starts at the middle of the object, where it rests.
    _base
      .set(...def.p)
      .copy(rest ?? _base)
      .add(_up.set(0, def.collider.offset[1], 0));
    const show = this.factor > LEADER_MIN && off.lengthSq() > 1e-8;
    leader.line.visible = show;
    if (!show) return;
    const attr = leader.line.geometry.getAttribute(
      'instanceStart',
    ) as InterleavedBufferAttribute;
    (attr.data.array as Float32Array).set([
      _base.x,
      _base.y,
      _base.z,
      _base.x + off.x,
      _base.y + off.y,
      _base.z + off.z,
    ]);
    attr.data.needsUpdate = true;
    leader.material.resolution.set(size.width, size.height);
    leader.material.opacity = Math.min(1, this.factor);
  }

  private leaderFor(entry: RegistryEntry): Leader {
    let leader = this.leaders.get(entry.id);
    if (leader) return leader;
    const material = this.art.lineSecondary.clone();
    material.transparent = true;
    material.alphaToCoverage = false;
    material.depthTest = false;
    material.opacity = 0;
    const line = new LineSegments2(
      new LineSegmentsGeometry().setPositions([0, 0, 0, 0, 0, 0]),
      material,
    );
    line.name = `explode-${entry.id}`;
    line.frustumCulled = false;
    line.renderOrder = 4;
    line.raycast = () => {};
    line.visible = false;
    this.group.add(line);
    leader = { line, material };
    this.leaders.set(entry.id, leader);
    return leader;
  }

  private dropLeader(id: string): void {
    const l = this.leaders.get(id);
    if (!l) return;
    this.group.remove(l.line);
    l.line.geometry.dispose();
    l.material.dispose();
    this.leaders.delete(id);
    this.offsets.delete(id);
    this.easing.delete(id);
  }

  dispose(): void {
    for (const id of [...this.leaders.keys()]) this.dropLeader(id);
    this.scene.remove(this.group);
  }
}
