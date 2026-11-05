# 01. Design spec v2: "The Blueprint"

Status: v2 for owner approval. Date 2026-11-05. v1 critiqued in `reviews/plan-critique-01-design.md`, `-02-engineering.md`, `-03-copy.md`; every Blocker and Major there is resolved here. Depends on `00-product-brief.md`, `profile/nihal-maskey.md`.

## 1. The one idea

The site is **one engineering drawing**: a sheet of Klein-blue paper with white ink. Not "a desk with a blueprint look". Every element is something a drawing has:

| Drawing element | On the site |
|---|---|
| **Title block** (boxed corner panel: title, drawn by, date, rev, scale, sheet) | The hero. Name, one sentence, email, local time, "rev 2026.11", "sheet 1 of 1", "scale 1:1". |
| **The drawn object** | A real-time 3D line drawing of the things he actually built, lying on the sheet: Arduino + live OLED, three clocks, a Bikram Sambat desk calendar, the Pac-Man ghost, and (if the owner confirms) the toy Land Cruiser. You can pick them up and throw them. |
| **Dimension lines and callouts** | Lift an object and leader lines with mono dimensions and a two-word note appear as DOM text. Put it down and they fade. |
| **Exploded view** | Scrolling the first viewport pulls the objects apart along one axis with leader lines, the way a parts drawing explodes, then the paper panels take over. |
| **Sheet index / revision table** in the margin | The nav. Rows: desk · work · open source · writing · cv · contact · colophon. Current row is filled. |
| **Revision history** | The open-source ledger, framed as a revision table. |
| **Border** | The page ends where the drawing border ends: the title block's frame closes the sheet. No street scene. |

Why: white line art carried all the way into real-time 3D is cheap on GPUs, degrades to an identical static SVG, is already his brand (lahin-kit), and has no whole-site precedent in the award record. Desk toys, drive-around cars, fake operating systems and cats do (Simon 2019, Heffernan 2022, Lusion 2023); the blueprint *behaviours* (callouts, exploded view, title block) do not.

Cut from v1: coffee cup, pencil, paper stack, bus-stop sign, bus route, bus, bench, street lamp, cat, `終点`, "bus departs" egg, pointer-following ghost, idle steam, hero ink draw-in on glyph outlines, `#now`.

## 2. Visual system

### 2.1 Colour (lahin-kit values, unchanged)
| Token | Value | Use |
|---|---|---|
| `--blue` | `#1F3FE0` | The sheet. Also the WebGL clear colour (opaque canvas, same pipeline, identical by construction). |
| `--blue-deep` | `#142FB8` | Pressed states, the sheet border band |
| `--blue-ink` | `#0A1C6B` | Text on paper panels |
| `--paper` | `#F6F5F1` | Paper panels |
| `--white` | `#FFFFFF` | Ink, structural strokes (opacity 1.0) |
| `--line-2` | `#DED9FA` | Secondary strokes (dimension lines, grid). Pre-blended white@0.85 over blue; shipped opaque, never alpha |
| `--mist` | `rgb(255 255 255 / .12)` | Hairlines, hover wash |
| `--mist-strong` | `rgb(255 255 255 / .30)` | Borders, focus halo on blue |
| `--ok` `--warn` `--bad` | `#9BF6C4` `#FFD56B` `#FF8A8A` | OLED readouts and form states only |

No gradients. No shadows on blue. No blur. Paper panels: 1 px `--blue-ink`/14% hairline, no shadow. Contrast: white/blue 7.9:1, ink/paper 13.5:1.

### 2.2 Type (two families)
| Role | Face | Setting |
|---|---|---|
| Display | **Fraunces** variable, instanced to wght 500-700, opsz 14-144, SOFT 0, WONK 0-1 | Headings lowercase, wght 500-600. WONK 1 on the name only. Tracking -0.01em above 48 px. |
| Body | **Fraunces** at small optical size (opsz 14), wght 400-500, SOFT 0 | 17 px / 1.55 on paper, measure ≤ 64ch. Crisp, not cuddly. |
| Labels, numbers, tables, code | **JetBrains Mono** variable (wght 400-600) | Uppercase labels 11-13 px tracked 0.08em; tabular numerals; all dates, times, dimensions. |

Inter is dropped. Fonts self-hosted, latin only, instanced + subset (budget ≤ 130 KB total), preloaded, `size-adjust` metric fallbacks so the 128 px name does not shift. Scale: 12 label / 15 small / 17 body / 22 lead / 28 h3 / 40 h2 / 64-128 name. Sentence case. Lowercase only on headings and the sheet index, never body copy.

### 2.3 Line language
One drafting hand. Structural strokes 1.5 CSS px white, round caps. Secondary strokes 1 px `--line-2`. Dimension lines with 45° tick terminators (drafting convention, not arrowheads). The same code-built models (`scripts/models`, three.js in Node) produce both the runtime GLB crease lines and the SVG poster (projected through the hero camera), so 2D and 3D match exactly.

### 2.4 Layout
12-column fluid grid, 24 px gutters, 1280 px max, 16 px gutters on phones. The sheet has a drawn **border** (1 px white, 24 px inset on desktop, 12 px on phones) with the sheet index running inside the left margin on ≥ 1024 px and as a bottom strip below. Text blocks on columns 2-7 or 6-12, never centered. Sections alternate sides. Rhythm 160 px desktop / 96 px phones. No equal-tile grids.

### 2.5 Surfaces
Blue sheet (hero, nav, section marks, 3D, border). Paper panel (anything longer than two lines; straight edges, 6 px radius). Plain mode: same tokens, SVG poster instead of 3D, motion off. One theme.

## 3. Page structure (single route `/`)

| # | id | Index row | Content |
|---|---|---|---|
| 1 | `desk` | desk | **Title block** (paper, bottom-left of the drawing on desktop; first on phones): `nihal maskey` h1, one sentence, email (copy), local time, rev/sheet/scale lines in mono. The 3D drawing fills the rest. Under it: object list (mono links, the keyboard path; visible on phones and on focus), "reset the desk". Skip link "skip the 3D desk" before it. |
| 2 | `work` | work | Five paper panels, each with a mono date line (what happened, when) replacing v1's `#now`. Trayt Health (empty drawing frame with the title block filled in, since there is no code to show) · TZ Converter · Space Hog · Car sensors · Pac-Man (arcade panel, button "play"). |
| 3 | `open-source` | open source | Revision table: repo · what · merged. Counts from GitHub at build. |
| 4 | `writing` | writing | Five posts: date · title · one line. Link to Hashnode. |
| 5 | `cv` | cv | Mono table of roles and dates; education; résumé link only if a live PDF exists. |
| 6 | `contact` | contact | Email (copy + mailto), three 2D clocks (cities per owner), overlap sentence, form, github / linkedin / x. |
| 7 | `colophon` | colophon | Copyright, analytics statement, source link. The border closes under it. |

Legacy anchors (`#projects`, `#about`, `#blog`, `#experience`, `#education`) map to the new ids via the head script.

## 4. The drawing (3D) in detail

### 4.1 Objects (≤ 7 dynamic bodies)
| id | Object | Why it is his | Behaviour | Tap → |
|---|---|---|---|---|
| `arduino` | UNO R4 + breadboard + 1.3" OLED (**hero object, centre**) | sensor-for-cars repo, Oct 2026 blog post | OLED is a 128×64 `CanvasTexture`, 5×7 pixel font, cycling "WATER 18.4C · AIR 21.1C · RH 54%" with the off-road truck sprite from his post; 2 fps; DOM caption says "demo values". Stops when hidden or reduced motion. | `#work` car sensors |
| `clock-ktm` `clock-2` `clock-3` | Three desk clocks | TZ Converter; team across Nepal, Australia, US | Hands from real time, same clock source as the title block and `#contact`. Labels in mono. Cities 2 and 3 from owner. | `#contact` |
| `calendar` | Bikram Sambat desk calendar | spatie/holidays Nepal calendar PR; Kathmandu | Shows today's BS date (deterministic conversion) and marks a public holiday when one falls today, from a JSON ported from his PR data. | `#open-source` |
| `ghost` | Pac-Man ghost | internship project | Static figure. Under physics it is a kinematic body (pushes others), dynamic after a throw, kinematic again when asleep. Eyes look at the pointer while grabbed. No idle following. | `#work` pac-man |
| `cruiser` | Toy Land Cruiser (HJ60) | car sensors | Only if owner confirms. Wheels roll when pushed. **No generic fallback**; absent if unconfirmed. | `#work` car sensors |
| `sheet` | The sheet surface, border and title block frame | | Static. Floor + 4 walls + ceiling colliders (invisible). | |

### 4.2 Rendering (line art that works)
Three passes per object, no lights, no textures (one OLED canvas), no post-processing:
1. **Occluder**: `MeshBasicMaterial({color: BLUE, polygonOffset: true, factor: 1, units: 1, toneMapped: false})`.
2. **Silhouette**: inverted hull: same geometry, `side: BackSide`, white, vertex shader pushes along the normal by a screen-constant 1.5 px (`onBeforeCompile`). Gives an outline on every curved surface.
3. **Creases**: chosen per part in the code-built models (`scripts/models`), exported as a `LINES` primitive in the GLB, rendered with `LineSegments2` + `LineMaterial` (`linewidth 1.5`, `worldUnits false`, `resolution` updated on resize, `alphaToCoverage`, `toneMapped false`). Secondary dimension lines use `--line-2` opaque.
Canvas: opaque (`alpha: false`), clear colour `--blue`, `flat` (no tone mapping), sRGB output. Camera 35° FOV, `near 0.5 / far 8`, fixed; pointer nudge ±2° on desktop, lerped with a convergence threshold. Colour check tolerance ±2/255. Lines are not raycastable; raycast against occluders only.

### 4.3 Dimension callouts (signature interaction 1)
Grabbing an object spawns 2-3 leader lines (`LineSegments2`, `--line-2`) from the object to anchor points at the edge of the drawing, each ending in a DOM label (positioned via `drei/Html transform={false}`, portaled under the canvas, `role="tooltip"`): a dimension in mm and a two-word note from `objects.ts` (e.g. "68.6 mm · uno r4", "ø 72 mm · ktm"). Fade in 160 ms, fade out 240 ms on release. Under reduced motion: static.

### 4.4 Exploded view (signature interaction 2)
Scroll progress over the first viewport (0 → 1) drives an **explode factor**: each object translates along +Y and slightly outward from its home by `factor * offset[i]`, and leader lines draw from home to exploded position. Objects at rest only; a grabbed or moving body is excluded until it sleeps. Implemented as a passive scroll listener writing a ref, `useFrame` lerps (0.12) toward it and self-invalidates until converged. Under reduced motion: no explode. No camera tilt, no pinning, native scroll.

### 4.5 Physics
`@react-three/rapier`, loaded **only on first pointerdown/press on an object** (never on idle). Until then objects are static meshes and the OLED/clocks still tick. Architecture: one static tree owns the Object3D instances in a registry; the physics layer **reparents imperatively** into `RigidBody` groups in `useLayoutEffect`, copying pose, then `body.sleep()`, so nothing flashes or settles. `objects.ts` holds body defs: home pose, primitive collider (cuboid / ball / capsule only), mass, dimension labels, target section. Fixed step 1/60, `interpolate`, damping 0.6/0.8. Six static colliders (floor, 4 walls, ceiling). Render on demand: `useAfterPhysicsStep` calls `invalidate()` while any body is awake. Watchdog: out of bounds (`|x|>1.2 || |z|>0.8 || y>1 || y<-0.2 || !isFinite`) for 2 s → respawn at home with zero velocity.

### 4.6 Input
- **Desktop**: pointerdown on an object (raycast occluders) → `setPointerCapture`, body kinematic, follows the pointer on the desk plane with 0.08 lerp, tilt clamped 25°. Release → dynamic, `wakeUp()`, `setLinvel` from a 5-sample ring buffer of plane points (m/s, clamp 4). Tap (< 6 px, < 250 ms) → navigate (see 5). Hover: mesh (not body) lifts 4 mm; label opacity 0.5 → 1.0. Labels are visible at rest at 0.5 so a screenshot is legible.
- **Touch**: canvas `touch-action: pan-y` so the page always scrolls. Grab needs a **press-and-hold of 180 ms on an object hit**; then a non-passive `touchmove` listener calls `preventDefault()` only while a body is grabbed. Tap navigates, pan scrolls. Double-tap on empty desk resets. The sheet index dims to 40% while dragging; never hidden.
- **Keyboard**: the object list under the canvas is the only keyboard path (poster is `inert` once the canvas is live). `R` with the desk region focused resets. Enter on a list item navigates.
- Reset button "reset the desk" in the DOM, always visible.

### 4.7 Sound (optional, default off)
Toggle "sound" with state text, `aria-pressed`, persisted. AudioContext created on toggle press only. Wood tap on drop (3 variants by impact speed), clock tick once a minute. ≤ 20 KB. Muted when hidden.

### 4.8 Performance rules
- Island is `client:only="react"`; the shell imports nothing from three. Scene chunk loads after the hero intersects AND the browser is idle (`requestIdleCallback` shim, 1.5 s max). Poster (inline SVG) shows until then and stays as the fallback; title block text is visible at first paint and is the LCP element.
- `frameloop="demand"`, DPR 1 on `hardwareConcurrency ≤ 4` or phones, else 1.5. No `PerformanceMonitor`. `resize={{debounce: 200}}`. Canvas height in `svh`.
- Every lerp has a convergence threshold and snaps; invalidate sources: pointer move, lerps, scroll, clock 1 s, OLED 500 ms, physics while awake, label show/hide, restore, respawn.
- Pause when `document.hidden` or the desk is > 1 viewport away (`frameloop="never"`, physics `paused`).
- Context loss: `preventDefault`, show poster + "3D paused. Reload if it doesn't come back.", one restore attempt, then poster for the session. One WebGL canvas on the page.
- Disposal on unmount: geometries, materials, textures, renderer; `useGLTF.clear()`.

### 4.9 Fallbacks (one code path, several triggers)
Any of: `prefers-reduced-motion: reduce`, the motion toggle, no WebGL2 (probe memoised and released), `saveData`, `deviceMemory < 4` where exposed, viewport < 360 px, JS off, island error (error boundary) → the SVG poster of the same drawing. Objects in the poster are not links; the object list below is. Nothing else on the page changes.

## 5. Motion

Motion states something: arrival, weight, focus, progress. Durations 160 ms micro / 320 ms panel / 600 ms scene. Easing `cubic-bezier(.2,.7,.2,1)`; physics for objects; no bounce or elastic. `transform` and `opacity` only. Reduced motion: only opacity fades ≤ 200 ms remain.

| Moment | What moves | How |
|---|---|---|
| Load | The h1 (real text) is revealed by a `clip-path: inset()` wipe left→right, 600 ms, like a pen ruling a line. Title block lines fade 160 ms after. The poster is already there. **This is the only draw-in on the site.** | CSS |
| Scroll 0 → 1 vh | Exploded view (4.4) | scroll ref + `useFrame` lerp |
| Sheet index | A 1 px white rule in the margin fills to scroll progress via `clip-path` rect `scaleY(var(--progress))` on a lit copy over a `--mist` copy; rows take `aria-current` when their section crosses the viewport midline | CSS `animation-timeline: scroll(root)` with JS fallback; IO `rootMargin -50% 0 -50% 0` |
| Section enter | Paper panels fade in (opacity only, 320 ms). No translate, no stagger. | IO + CSS |
| Case-panel drawings | Already drawn. No draw-in. | |
| Ledger row hover/focus | The row's leader line extends 24 px to the link, 160 ms | CSS |
| Object tap → section | The object's callout label is the shared element: it travels with the scroll (600 ms, `scrollIntoView` smooth or auto per `data-motion`) and lands as the section's mono date line; the drawing explodes to 1 as the page leaves it | single scroll owner: the tap handler; no global `scroll-behavior` |
| Email copy | text → "copied" 1.6 s | script |
| Grab / release | Callouts 160 / 240 ms (4.3) | React state + CSS |

No smooth-scroll library. No GSAP.

## 6. Components
Astro (static + vanilla hoisted scripts): `SheetBorder`, `SheetIndex` (nav), `TitleBlock`, `PaperPanel`, `Section`, `RevisionTable` (real `<table>` + `<caption>`), `ClockFace` (SVG, 1/min), `CopyEmail`, `MotionToggle`, `SoundToggle`, `Poster` (inline SVG `role=img`), `ObjectList`, `ArcadePanel` (button "play" → sandboxed lazy iframe of his GitHub Pages Pac-Man, `title`, Escape returns focus, direct link; sandbox is safe only because the game is cross-origin), `Colophon`.
React islands: `Desk` (`client:only`), `ContactForm` (`client:visible`; progressive enhancement over Formspree, native `action`, `_gotcha` honeypot, `_next` to `/sent`, inline validation, live-region errors).

## 7. States
Loading (poster, no spinner, no percentage). Physics loading ("loading 3D" under the pointer < 1 s). 3D unavailable ("3D is off on this device. Everything still works."). Context lost. Empty list. Form error / success / network error. `/sent` page (no-JS success). 404 ("sheet not found" in an empty title block: "nothing here"). Focus: 2 px `--mist-strong` ring on blue, 2 px `--blue` on paper; never `outline: none`. Touch: press states only. Print: paper everywhere, 3D and index hidden, cv table prints.

## 8. Responsive
- ≥ 1280: drawing fills the hero, title block bottom-left over the sheet, index in the left margin.
- 768-1279: camera back 15%, index as dots in the margin.
- < 768: **title block first** (name, sentence, email, time), drawing `clamp(320px, 48svh, 420px)` second, object list third (44 px targets), index as a bottom strip. Landscape phones: drawing ≤ 50svh. Physics after first press-and-hold only.
- No horizontal scroll at 320 px.

## 9. Accessibility (WCAG 2.2 AA; AAA contrast)
Canvas `aria-hidden`; poster `role="img"` with description; object list = real links, one DOM node for all viewports, visible on `:focus-within` and on phones; poster `inert` when canvas live. Skip link first. Visible focus everywhere. Reduced motion by media query and toggle (also stops OLED, clocks still update text). **The OS setting is a floor**: effective motion is `reduce` if the OS asks for it or the visitor chose it; the site never re-enables motion the OS turned off. Under OS reduce the toggle shows pressed, is `aria-disabled="true"` (stays focusable), and a mono note reads "set by your system". Sound never autoplays. All text is DOM. Form labels, `aria-describedby` errors, 44 px targets. Iframe titled, Escape route, direct link. Callout tooltips are DOM text. Colour never the only signal.

## 10. Slop gates (visual; reviewer fails the ticket on any)
Gradient; glass/blur; shadow on blue; centered hero with two buttons; pill badge above a heading; round-number stat row; three equal icon cards; Lucide/Heroicons as decoration; emoji or ♥ glyphs; bento grid; marquee; pulsing dot; blinking cursor; bounce/elastic easing; purple; Inter anywhere; Title Case; stock illustration/photo; abstract 3D blob; preloader with percentage; testimonial; logo wall; custom cursor or cursor follower; "01 / 02" section numerals; "scroll ↓" indicator; stroke draw-in on more than the hero; fade-up-and-translate section entrances; lowercase body copy; "made with" footer; font-list colophon; decorative foreign-language glyphs; captioning the toy ("the desk is real").

## 11. Assets
- Code-built models (`scripts/models`, no Blender): `sheet`, `arduino` (board + OLED frame), 3 clocks (one model, three labels), `calendar`, `ghost`, `cruiser` (conditional). ≤ 1.2k tris each, ≤ 8k total, ≤ 150 KB GLB total, each with a `LINES` crease primitive. Poster SVG (≤ 16 KB) projected from the same line data.
- SVG marks for the five work panels (one per project, same hand).
- Fonts: Fraunces instanced, JetBrains Mono, latin, woff2, ≤ 130 KB total.
- OG 1200×630: title block + poster. Favicon: white drafting-pen nib on blue.
- Sounds: 3 taps + 1 tick, ogg + mp3, ≤ 20 KB, CC0 or self-recorded, licence noted.
- Holiday data JSON for the current BS year (ported from his spatie PR) + BS conversion table.

## 12. Owner decisions needed before modelling
1. Land Cruiser on the sheet: yes (which model, HJ60 or LC78) or no.
2. Cities for clocks 2 and 3.
3. Any wish to keep a Nepali-language end mark (e.g. "अन्तिम बिसौनी") on the colophon? Default: none.
4. Calendar: Bikram Sambat desk calendar OK? Holidays from your spatie data?
5. Full name once in `#cv`, or never.
