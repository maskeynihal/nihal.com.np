/**
 * What the renderer still held (`renderer.info.memory`) after the last Scene unmount disposed
 * everything. Lives outside the Scene so it survives the unmount; tests only (`testHooks`).
 */
let last: { geometries: number; textures: number } | null = null;

export const disposedProbe = {
  set: (m: { geometries: number; textures: number }) => {
    last = { ...m };
  },
  get: () => last,
};
