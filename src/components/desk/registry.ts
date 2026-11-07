import type { Object3D } from 'three';
import type { ObjectDef } from '../../lib/desk/object-def';

/**
 * One entry per shown object. The static tree (Scene) owns the Object3D instances; the physics
 * layer (lazy chunk) takes `obj` into a body's group and gives it back, so nothing here imports
 * three values or rapier.
 *
 *  - `obj`:  the group at the object's home pose (local to the table while `free` is false).
 *  - `pivot`: a group between `obj` and the model root. The scroll spring (D3) moves only this, and
 *    it is zero for anything held, moving or free, so a body, a handoff and a pick never see it.
 *  - `lift`: the model root inside `pivot`. Hover lift (4 mm) moves only this, never the body.
 *  - `free`: the object has left the table and lives in the fall layer (its own canvas).
 */
export interface RegistryEntry {
  id: string;
  def: ObjectDef;
  obj: Object3D;
  pivot: Object3D;
  lift: Object3D;
  free: boolean;
}

const entries = new Map<string, RegistryEntry>();
const listeners = new Set<() => void>();
let away = false;
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
  /** True while a free object is moving or rests off the table (drives the reset button). */
  setAway(next: boolean): void {
    if (away === next) return;
    away = next;
    emit();
  },
  anyAway: (): boolean => away,
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
