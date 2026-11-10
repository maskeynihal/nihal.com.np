# Asset pipeline (D-06)

No Blender. Models are code.

## Commands
- `pnpm assets`: rebuilds `src/assets/models/*.glb`, `src/assets/models/lines.json` and `src/assets/poster.svg`. Output is deterministic; the vitest suite in `scripts/models/models.test.ts` builds twice and compares bytes.
- `pnpm exec svgo -c svgo.config.mjs <file.svg>`: optimise an SVG (multipass, 2 decimals, viewBox kept).
- Fonts: `pnpm fonts` (see `scripts/fonts/`). The `instance-fonts.sh` named in the ticket is superseded by that script.

## Layout
- `scripts/models/geom.ts`: three.js primitives in Node, returning a `Part` (triangles, normals, authored crease segments). Rounded to 1e-6 m for cross-platform stability.
- `scripts/models/models.ts`: one builder per model (`sheet`, `arduino`, `clock`, `calendar`, `ghost`, `cruiser`), each returning a `body` plus named nodes. Units are metres, origin on the floor at the footprint centre, each model fits the collider in `src/content/objects.ts`. Creases are authored per part (box edges, rings, tick marks), never found by an angle threshold.
- `scripts/models/export.ts`: builds the glTF document directly with `@gltf-transform/core` (no `GLTFExporter`, so no Blob or FileReader shims), then `meshopt()` (reorder, quantize, EXT_meshopt_compression).
- `scripts/models/build.ts`: the CLI and the `buildAssets()` function used by tests and by D-01.

## GLB contract
One scene, one root node named after the model (identity transform, no mesh). Its children:
- `body`: the static mesh.
- One pivot node per named part. Pivots have no mesh; their only child is `<name>-mesh`. Rotate or move the pivot, never the mesh node (meshopt quantization writes a translate/scale onto mesh nodes only).

Every mesh has a triangle primitive (mode 4, `POSITION` + `NORMAL`, for occluder and inverted hull; `TEXCOORD_0` on the textured quads) and, when it has creases, a lines primitive (mode 1, `LINES`, `POSITION` only; extras `{ role: 'LINES' }`; glTF primitives carry no name, so mode 1 is the contract). Positions are quantized by meshopt, so mesh nodes carry a translate/scale that restores the authored frame. Apply node matrices; do not assume geometry sits at the object origin. The runtime needs `KHR_mesh_quantization` and `EXT_meshopt_compression` (set the three meshopt decoder on the loader).

Named nodes (all pivot origins are in the model's local frame, metres, y up):

| model | node | origin | use |
| --- | --- | --- | --- |
| `clock` | `hand-hour`, `hand-minute` | dial centre, y 0.0505 | rest pose points at 12 (-Z). Set `rotation.y = -angle`, angle clockwise from above (3 o'clock is +X). |
| `calendar` | `face` | pad centre, z just in front of the pad | `-mesh` is a +Z quad (0.13 x 0.075 m) with UVs: the BS date text texture. |
| `arduino` | `screen` | OLED glass centre | `-mesh` is a quad lying flat (+Y normal), 0.086 x 0.044 m, with UVs: the OLED texture. Top of the image is toward -Z. |
| `ghost` | `eye-l`, `eye-r` | eye centres | each eye is pre-turned 20 degrees outward; add the look-at rotation on top. |
| `cruiser` | none | | optional object, `confirmed: false`, kept out of the default poster. |

`ModelDef.build()` is the rest pose merged into one `Part` (used for bounds, tri counts, `lines.json`); `buildPosed()` additionally applies each node's `posterYaw` (clock hands at 10:10) and is used only by the poster. The GLB nodes stay at identity.

Budgets (tests): each model <= 1,200 triangles, objects <= 8,000 total, GLBs <= 150 KB total, poster <= 24 KB (see Workstation models). Authored lines that sit on a surface are lifted 0.3 mm (`LIFT`) so they never z-fight with it; textured quads sit 0.3 to 0.9 mm off their host.

## Shared line data for the SVG poster (D-01)
`src/assets/models/lines.json` is `{ [file]: number[] }`: flat `x y z x y z` pairs per segment in each object's local frame, unquantized, rest pose, body first then each named node in GLB order. D-01 can also import `models` and `buildAssets` from `scripts/models` to get triangles for silhouette extraction. Project both through the hero camera so 2D and 3D come from one source.

## Workstation models
Besides the table objects, the hero scene has a small workstation, each a model in `scripts/models/models.ts` (same GLB contract, origin on the floor or desk): `chair`, `dev` (the developer), `monitor`, `keyboard`, `mouse`, `lamp`, `mug`, `headphones`, `phone`, `plant` and `desk`. The `desk` kit is the board with an A-frame base (`legs` node, below y = 0), the drawer (`tray` node slides out toward +z, carrying its items) and the handset on the right front edge that sets the desk height. The desk is furniture, not an object: no collider, never picked. Build or change any of them, then run `pnpm assets` so the GLBs, `lines.json` and both posters (`poster.svg`, `poster-phone.svg`) are rebuilt together.

Models budget (enforced in `scripts/models/models.test.ts` and `poster.test.ts`): each model <= 1,200 triangles; all objects together <= 8,000 triangles (the sheet and table are furniture and not counted); all GLBs <= 150 KB; poster <= 24 KB and phone poster <= 20 KB, and the phone poster stays lighter than the desktop one. The GLBs are close to the byte budget, so check the total before adding detail.

## CI
Add `pnpm assets && git diff --exit-code src/assets` to the CI workflow when it exists (A-07 owns it).

## Poster, marks, nib (D-01)
- `src/assets/camera.ts`: the fixed hero camera (fov 35, near 0.5, far 8, position, lookAt) and poster viewBox (1200x800). Plain numbers; E-02 imports it so the canvas and the poster frame the desk identically.
- `scripts/models/poster.ts`: places each confirmed object at its `objects.ts` home pose, takes authored creases plus silhouette edges from the triangles, removes hidden lines by ray tests, projects through the hero camera, chains segments into two paths (sheet border 1 px `#ded9fa`; everything else 1.5 px white; `vector-effect: non-scaling-stroke`), svgo. `buildPoster({ includeUnconfirmed: true })` draws the owner-preview set.
- `src/assets/marks/<work id>.svg`: five hand-written 64x64 marks, `stroke="currentColor"`, so the panel sets the colour.
- `src/assets/nib.svg`: white drafting-pen nib, used by `scripts/assets/render-og.ts` for the favicons.

## Visual check (D-03)
`pnpm exec tsx scripts/spike/model-check.ts [outDir]` serves the GLBs with a tiny three.js page (`scripts/spike/model-viewer.html`, occluder + inverted hull + authored creases), renders each model from two angles, the hero scene through the shared camera, and the poster, into `docs/reviews/D-03/`. Compare `hero-3d.png` with `poster.png`: they must agree.
