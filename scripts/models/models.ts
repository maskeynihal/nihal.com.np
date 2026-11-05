/** Model registry. Grey-box models arrive in D-02. */
import type { Part } from './geom';

export interface ModelDef {
  /** GLB basename, matches `BodyDef.model` (without `.glb`). */
  file: string;
  /** Node name inside the GLB. */
  name: string;
  build: () => Part;
}

export const models: ModelDef[] = []; // filled in D-02
