/**
 * The one entry of the physics chunk: the table world and the fall world share the engine, the
 * handoff code and the colliders, so both come from a single dynamic import (a second entry
 * would make the bundler split the engine into a shared chunk that the entries import
 * statically, which `pnpm check:graph` forbids).
 */
export { default as TablePhysics } from './physics-world';
export { default as FallPhysics } from './fall-world';
