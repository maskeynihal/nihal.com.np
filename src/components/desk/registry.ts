import type { Object3D } from 'three';
import type { ObjectDef } from '../../lib/desk/object-def';

/**
 * One entry per shown object. The static tree (Scene) owns the Object3D instances; the physics
 * layer (lazy chunk) moves `obj` into a body's group and moves it back, so nothing here imports
 * three values or rapier.
 *
 *  - `obj`:  the group at the object's home pose. Explode (E-07) offsets it.
 *  - `lift`: the model root inside `obj`. Hover lift (4 mm) moves only this, never the body.
 *  - `bodyGroup`: set while the physics layer has reparented `obj` into a body (then `obj`
 *    sits at the body origin and only carries a local offset).
 */
export interface RegistryEntry {
  id: string;
  def: ObjectDef;
  obj: Object3D;
  lift: Object3D;
  parent: Object3D | null;
  bodyGroup: Object3D | null;
}

const entries = new Map<string, RegistryEntry>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const registry = {
  register(entry: Omit<RegistryEntry, 'parent' | 'bodyGroup'>): () => void {
    const full: RegistryEntry = {
      ...entry,
      parent: entry.obj.parent,
      bodyGroup: null,
    };
    entries.set(entry.id, full);
    emit();
    return () => {
      if (entries.get(entry.id) === full) entries.delete(entry.id);
      emit();
    };
  },
  /** The physics layer took the object into a body's group (null when it gave it back). */
  setBodyGroup(id: string, group: Object3D | null): void {
    const e = entries.get(id);
    if (e) e.bodyGroup = group;
  },
  get: (id: string): RegistryEntry | undefined => entries.get(id),
  all: (): RegistryEntry[] => [...entries.values()],
  subscribe(l: () => void): () => void {
    listeners.add(l);
    return () => listeners.delete(l);
  },
};

/** The object id a scene node belongs to (walks up to the registered group), or null. */
export function entryIdOf(node: Object3D): string | null {
  for (let o: Object3D | null = node; o; o = o.parent) {
    const id: unknown = o.userData['deskId'];
    if (typeof id === 'string') return id;
  }
  return null;
}
