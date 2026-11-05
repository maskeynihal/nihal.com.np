import type { Object3D } from 'three';
import type { ObjectDef } from '../../lib/desk/object-def';

/**
 * One entry per shown object. The static tree (Scene) owns the Object3D instances; the physics
 * layer (lazy chunk) moves `obj` out of the table group while an object is free and puts it
 * back, so nothing here imports three values or rapier.
 *
 *  - `obj`:  the group at the object's home pose (local to the table while `free` is false).
 *  - `lift`: the model root inside `obj`. Hover lift (4 mm) moves only this, never the body.
 *  - `free`: the object has left the table and lives in screen-space world coordinates.
 */
export interface RegistryEntry {
  id: string;
  def: ObjectDef;
  obj: Object3D;
  lift: Object3D;
  free: boolean;
}

const entries = new Map<string, RegistryEntry>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export const registry = {
  register(entry: Omit<RegistryEntry, 'free'>): () => void {
    const full: RegistryEntry = { ...entry, free: false };
    entries.set(entry.id, full);
    emit();
    return () => {
      if (entries.get(entry.id) === full) entries.delete(entry.id);
      full.obj.removeFromParent();
      emit();
    };
  },
  get: (id: string): RegistryEntry | undefined => entries.get(id),
  all: (): RegistryEntry[] => [...entries.values()],
  /** Marks an object free or back on the table; listeners hear about it. */
  setFree(id: string, free: boolean): void {
    const e = entries.get(id);
    if (!e || e.free === free) return;
    e.free = free;
    emit();
  },
  anyFree: (): boolean => [...entries.values()].some((e) => e.free),
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
