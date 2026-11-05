import type { Group, Object3D } from 'three';
import {
  layoutFor,
  pxToWorld,
  type Layout,
  type Viewport,
} from '../../lib/desk/view';
import { registry, type RegistryEntry } from './registry';

/**
 * The table's place in the page, shared by the Scene (draws it), Interaction (screen to world)
 * and the physics layer (kinematic collider). Written once per drawn frame by `syncTable`.
 * No three.js values are imported here: the Scene hands the groups in.
 */
export const table = {
  /** The group holding the sheet and every object that is on the table. */
  group: null as Group | null,
  /** The scene root: free objects live here. */
  root: null as Object3D | null,
  layout: { ppm: 500, ox: 0, oy: 0 } as Layout,
  viewport: { width: 1, height: 1 } as Viewport,
  /** Table origin on the z = 0 plane, world metres. */
  world: { x: 0, y: 0 },
  /** The poster frame is on or near the screen. */
  visible: false,
};

const listeners = new Set<() => void>();
export const tableEvents = {
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/** Reads the poster frame and moves the table group under it. Returns true if anything moved. */
export function syncTable(viewport: Viewport): boolean {
  const frame = document.querySelector<HTMLElement>('[data-poster]');
  if (!frame || !table.group) return false;
  const rect = frame.getBoundingClientRect();
  const next = layoutFor(rect);
  const margin = 80;
  const visible = rect.bottom > -margin && rect.top < viewport.height + margin;
  const w = pxToWorld(next.ox, next.oy, viewport, next.ppm);
  const changed =
    next.ppm !== table.layout.ppm ||
    w.x !== table.world.x ||
    w.y !== table.world.y ||
    viewport.width !== table.viewport.width ||
    viewport.height !== table.viewport.height ||
    visible !== table.visible;
  table.layout = next;
  table.viewport = viewport;
  table.world = w;
  table.visible = visible;
  table.group.position.set(w.x, w.y, 0);
  if (changed) listeners.forEach((l) => l());
  return changed;
}

/** Takes an object off the table, keeping its world pose. */
export function detach(entry: RegistryEntry): void {
  if (!table.root || entry.free) return;
  entry.obj.updateWorldMatrix(true, false);
  table.root.attach(entry.obj);
  registry.setFree(entry.id, true);
}

/** Puts an object back at its home pose on the table. */
export function reattach(entry: RegistryEntry): void {
  const { def, obj } = entry;
  table.group?.add(obj);
  obj.position.set(...def.p);
  obj.quaternion.set(...def.q);
  registry.setFree(entry.id, false);
}
