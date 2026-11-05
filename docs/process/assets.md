# Asset pipeline (D-06)

No Blender. Models are code.

## Commands
- `pnpm assets`: rebuilds `src/assets/models/*.glb`, `src/assets/models/lines.json` and `src/assets/poster.svg`. Output is deterministic; the vitest suite in `scripts/models/models.test.ts` builds twice and compares bytes.
- `pnpm exec svgo -c svgo.config.mjs <file.svg>`: optimise an SVG (multipass, 2 decimals, viewBox kept).
- Fonts: `pnpm fonts` (see `scripts/fonts/`). The `instance-fonts.sh` named in the ticket is superseded by that script.

## Layout
- `scripts/models/geom.ts`: three.js primitives in Node, returning a `Part` (triangles, normals, authored crease segments). Rounded to 1e-6 m for cross-platform stability.
- `scripts/models/models.ts`: one builder per model (`sheet`, `arduino`, `clock`, `calendar`, `ghost`, `cruiser`). Units are metres, origin on the floor at the footprint centre, each model fits the collider in `src/content/objects.ts`. Creases are authored per part (box edges, rings, tick marks), never found by an angle threshold.
- `scripts/models/export.ts`: builds the glTF document directly with `@gltf-transform/core` (no `GLTFExporter`, so no Blob or FileReader shims), then `meshopt()` (reorder, quantize, EXT_meshopt_compression).
- `scripts/models/build.ts`: the CLI and the `buildAssets()` function used by tests and by D-01.

## GLB contract
One scene, one node, one mesh with two primitives: triangles (mode 4, `POSITION` + `NORMAL`, for occluder and inverted hull) and creases (mode 1, `LINES`, `POSITION` only; extras `{ role: 'LINES' }`; glTF primitives carry no name, so mode 1 is the contract). Positions are quantized by meshopt, so the node carries a translate/scale that restores the authored frame. Apply the node matrix; do not assume geometry sits at the object origin. The runtime needs `KHR_mesh_quantization` and `EXT_meshopt_compression` (set the three meshopt decoder on the loader).

## Shared line data for the SVG poster (D-01)
`src/assets/models/lines.json` is `{ [file]: number[] }`: flat `x y z x y z` pairs per segment in each object's local frame, unquantized. D-01 can also import `models` and `buildAssets` from `scripts/models` to get triangles for silhouette extraction. Project both through the hero camera so 2D and 3D come from one source.

## CI
Add `pnpm assets && git diff --exit-code src/assets` to the CI workflow when it exists (A-07 owns it).

## Poster, marks, nib (D-01)
- `src/assets/camera.ts`: the fixed hero camera (fov 35, near 0.5, far 8, position, lookAt) and poster viewBox (1200x800). Plain numbers; E-02 imports it so the canvas and the poster frame the desk identically.
- `scripts/models/poster.ts`: places each confirmed object at its `objects.ts` home pose, takes authored creases plus silhouette edges from the triangles, removes hidden lines by ray tests, projects through the hero camera, chains segments into two paths (sheet border 1 px `#ded9fa`; everything else 1.5 px white; `vector-effect: non-scaling-stroke`), svgo. `buildPoster({ includeUnconfirmed: true })` draws the owner-preview set.
- `src/assets/marks/<work id>.svg`: five hand-written 64x64 marks, `stroke="currentColor"`, so the panel sets the colour.
- `src/assets/nib.svg`: white drafting-pen nib, used by `scripts/assets/render-og.ts` for the favicons.
