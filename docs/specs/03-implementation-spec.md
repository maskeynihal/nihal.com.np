# 03. Implementation spec v2

Status: v2. Date 2026-11-05. v1 critiqued in `reviews/plan-critique-02-engineering.md`; all Blockers and Majors applied.

## 1. Stack
| Layer | Choice | Notes |
|---|---|---|
| Framework | **Astro 7**, `@astrojs/react` (React 19), static output, **no Vercel adapter** | React only for `Desk` (`client:only="react"`) and `ContactForm` (`client:visible`). Everything else Astro + vanilla hoisted `<script>` (no hydration, CSP-clean). |
| 3D | three 0.187, `@react-three/fiber` 9.8.x, `@react-three/drei` 10.7.x (only `useGLTF`, `Html`), `three/addons/lines/*` | WebGLRenderer. `flat`, `alpha:false`, clear colour blue. |
| Physics | `@react-three/rapier` 2.2.x | Lazy chunk, loaded on first grab only. Variant (compat vs real `.wasm`) decided by E-11 spike. |
| Gestures | `@use-gesture/react` or hand-rolled pointer events (decide in E-06; pointer capture + press-hold needed either way) | |
| Motion | **No GSAP.** CSS (`clip-path`, `animation-timeline`, transitions) + one passive scroll listener feeding the desk | |
| Styling | Tailwind v4 with `@theme` tokens + `tokens.css` | |
| Content | `src/content/*.ts` validated by Zod at build; generated `github.json` with committed fallback | Prose-only copy gate on this tree |
| Dates | `Intl.DateTimeFormat`; BS conversion via a vetted small library or a committed table (ticket B-09) | |
| Forms | Formspree `xanoenzo`; `_gotcha`; `_next=/sent`; `Accept: application/json` on fetch | |
| Tests | Vitest; Playwright (6 projects); `@axe-core/playwright`; Lighthouse CI on `staticDistDir`; size-limit; copy-gate; link check | |
| CI/CD | GitHub Actions; Vercel preview per PR, prod on `main`; Node 24 if Vercel supports else 22 | |
| PM | pnpm 10 | |

## 2. Layout
```
astro.config.ts  package.json  pnpm-lock.yaml  .nvmrc  tsconfig.json  vercel.json (generated)
public/  fonts/ (instanced woff2)  sounds/  og.png  favicon.svg  favicon.png  apple-touch-icon.png  manifest.webmanifest  robots.txt
assets/blender/ (*.blend, export scripts)  assets/svg-src/
src/
  pages/ index.astro  404.astro  sent.astro
  layouts/ Base.astro
  styles/ tokens.css  global.css  motion.css  print.css
  content/ copy.ts  work.ts  oss.ts  writing.ts  cv.ts  objects.ts (desk defs + callouts)  holidays.json  schema.ts  generated/github.json
  assets/models/*.glb (imported with ?url so Vite hashes them)
  components/ (Astro) SheetBorder SheetIndex TitleBlock PaperPanel Section RevisionTable ClockFace CopyEmail MotionToggle SoundToggle Poster ObjectList ArcadePanel Colophon Marks/
  islands/ Desk/ (Desk.tsx shell, Scene.tsx lazy, Registry.ts, objects (static tree), physics/ (PhysicsWorld.tsx, PhysicsBody.tsx), materials/ (occluder, hull, lines), Oled.ts, Callouts.tsx, useDemandLoop.ts, useContextLoss.ts, input/ (pointer, touch, keyboard))  ContactForm.tsx
  lib/ prefs.ts  time.ts  bs-date.ts  sound.ts  analytics.ts  anchors.ts
scripts/ copy-gate.ts  fetch-github.ts  write-vercel-json.ts (postbuild CSP hashes)  check-initial-graph.ts  optimize-models.sh  instance-fonts.sh  check-links.ts  review.ts
e2e/ fixtures/ (console-fail, hooks)  *.spec.ts  (tagged @A-xx etc.)
playwright.config.ts  vitest.config.ts  lighthouserc.cjs  size-limit.json  .github/workflows/ci.yml
docs/
```

## 3. Preferences and capability (`prefs.ts` + inline head script)
Inline `<script is:inline>` (hashed in CSP) runs before CSS: `try { localStorage }` guarded; sets `html[data-motion=reduce|full]` (reduce if stored or media query), `html[data-sound=on|off]`; maps legacy fragments (`#work→#projects`, `#about→#desk`, `#blog→#writing`, `#experience→#cv`, `#education→#cv`) via `location.replace`.
```ts
let cached: boolean | undefined
export function hasWebGL2(allowSoftware = !!import.meta.env.PUBLIC_TEST_HOOKS) {
  if (cached !== undefined) return cached
  try {
    const gl = document.createElement('canvas').getContext('webgl2', { failIfMajorPerformanceCaveat: !allowSoftware })
    cached = !!gl; gl?.getExtension('WEBGL_lose_context')?.loseContext()
  } catch { cached = false }
  return cached
}
export const canRun3D = () =>
  document.documentElement.dataset.motion === 'full' && innerWidth >= 360 &&
  !(navigator as any).connection?.saveData &&
  !(typeof (navigator as any).deviceMemory === 'number' && (navigator as any).deviceMemory < 4) &&
  hasWebGL2()
export const dprFor = () => ((navigator.hardwareConcurrency ?? 4) <= 4 || matchMedia('(pointer: coarse)').matches) ? 1 : 1.5
```
`requestIdleCallback` shim: `setTimeout(cb, 1)`. Physics never preloads; it loads on the first grab.

## 4. Desk island architecture
- `Desk.tsx` (shell, imports nothing from three): poster/canvas swap, error boundary (fallback = poster + "3D paused"), `canRun3D` check on intersection + idle, `React.lazy(() => import('./Scene'))`, object list wiring, reset button, `window.__hooks.desk` hooks when `PUBLIC_TEST_HOOKS`.
- `Scene.tsx`: `<Canvas frameloop="demand" flat dpr={dpr} gl={{alpha:false, antialias:true, powerPreference:'low-power', depth:true}} camera={{fov:35, near:0.5, far:8}} resize={{debounce:200}} onCreated={({gl}) => gl.setClearColor(BLUE)}>`. Children: `<StaticDesk registry/>` always mounted; `<Suspense fallback={null}>{physicsWanted && <PhysicsWorld registry/>}</Suspense>`; `<Callouts/>`; `<Explode/>`.
- `Registry.ts`: map id → `{obj: Object3D, def: BodyDef}`; static group holds all objects at home poses.
- Materials: `occluder` (`MeshBasicMaterial` blue, polygonOffset 1/1, `toneMapped:false`), `hull` (same geo, `BackSide`, white, `onBeforeCompile` normal push by `1.5 * dpr * clipW / (res.y * proj[1][1])`), `lines` (`LineMaterial` 1.5 px, `resolution` set from `useThree(s=>s.size)` on change, `alphaToCoverage`, colours white / `#DED9FA` opaque). Crease `LINES` primitives from the GLB → `LineSegmentsGeometry.fromLineSegments` → `LineSegments2`; `raycast = () => {}` on all line objects.
- `objects.ts`: `{ id, model, home: {p,q}, collider: {kind:'cuboid'|'ball'|'capsule', args, offset}, mass, kinematicWhenIdle?: boolean, callouts: [{anchor, text}], target: '#work-car' | ... , explode: Vector3 }`. ≤ 7 dynamic bodies.
- `PhysicsWorld.tsx` (lazy chunk `physics`): `<Physics timeStep={1/60} interpolate paused={!visible}>`; 6 fixed colliders; `PhysicsBody` per def: in `useLayoutEffect` copy world pose into the body, reparent `obj` into the body group, `body.sleep()`; cleanup reparents back to the static group at home. `useAfterPhysicsStep(world => { if (anyAwake(world)) invalidate() })`. Watchdog in the same hook.
- Input (`input/`): pointerdown → raycast occluders → `setPointerCapture` → if physics not loaded, request it and hold the hit; body → `kinematicPosition`; move → `setNextKinematicTranslation(lerp(target, 0.08))` on the desk plane, rotation tilt clamped; ring buffer of 5 `{p, t}`; up → `dynamic`, `wakeUp()`, `setLinvel(clamp(v, 4))`; tap (< 6 px, < 250 ms) → `window.dispatchEvent(new CustomEvent('nihal:navigate', {detail: target}))`. Touch: canvas `touch-action: pan-y`; non-passive `touchmove` on canvas calls `preventDefault()` only while `grabbed`; grab requires 180 ms press-hold on a hit (timer cancelled by movement > 8 px). Keyboard: `R` on the desk region → reset. Hover: `obj.children[mesh].position.y = 0.004` (not the body).
- Explode: passive `scroll` listener writes `targetRef = clamp(scrollY / hero.height)`; `useFrame` lerps `factor` 0.12 toward it, applies `home + explode * factor` to resting bodies/objects (skip awake bodies), draws leader lines, `invalidate()` until `|Δ| < 1e-3` then snap.
- Callouts: on grab, show the def's callouts: leader lines (`LineSegments2`) + `drei/Html transform={false} zIndexRange={[10,0]} portal={underCanvasRef}` labels.
- OLED: `Oled.ts` pure `frame(n): ImageData`; runtime `setInterval(500)` while visible → `texture.needsUpdate = true; invalidate()`.
- Clocks: hands updated by a 1 s interval → `invalidate()`; same `time.ts` source as DOM clocks.
- Visibility: `visibilitychange` + IO (`rootMargin: '100%'`) → `setFrameloop('never')` and physics `paused`; intervals cleared.
- Context loss: `webglcontextlost` → `preventDefault`, `setLost(true)`; `webglcontextrestored` → `setLost(false)` once; second loss permanent.
- Disposal on unmount: traverse dispose geometries/materials/textures; `gl.dispose()`; `useGLTF.clear(urls)`.
- Navigation event handled by a vanilla script: `scrollIntoView({behavior: html.dataset.motion === 'full' ? 'smooth' : 'auto', block: 'start'})`, then focus the section heading (`tabindex=-1`). No global `scroll-behavior`. Shared-element callout: the label element is cloned into a fixed layer, transitioned 600 ms to the section's date line position, removed on arrival (reduced motion: skipped).

## 5. Chunking and SSR safety
```ts
// astro.config.ts
export default defineConfig({
  integrations: [react()],
  vite: {
    resolve: { dedupe: ['three', 'react', 'react-dom', '@react-three/fiber'] },
    build: { rollupOptions: { output: { manualChunks(id) {
      if (id.includes('@dimforge/rapier3d')) return 'physics'
      if (/node_modules\/(three|@react-three|react-reconciler|@use-gesture|its-fine|zustand)/.test(id)) return 'desk-vendor'
    }}}}
  }
})
```
`<Desk client:only="react" />`; Poster is a separate Astro component. `scripts/check-initial-graph.ts` (postbuild): parse `dist/index.html` for module scripts and `astro-island component-url`, walk static imports with `es-module-lexer`, fail if any reachable chunk matches `/desk-vendor|physics|REVISION/`. No `modulepreload` for desk chunks.

## 6. Sheet index, progress, enters
- Progress: two dotted `<path>`s in the fixed margin SVG (`--mist` base, white lit) with the lit path inside `<g clip-path>` whose `<rect>` has `transform: scaleY(var(--progress))`, `transform-origin: top`. CSS: `animation: progress linear both; animation-timeline: scroll(root);` (timeline declared after the shorthand). `@supports not (animation-timeline: scroll())` → passive scroll listener, rAF-coalesced, sets `--progress`. Under `[data-motion=reduce]` the JS path is used with no transition (still shows progress; it is state, not motion).
- `aria-current`: IO `{rootMargin: '-50% 0px -50% 0px', threshold: 0}` on sections; sections have `scroll-margin-top`.
- Panel enter: IO once, add `.in`; CSS `opacity 320ms`. Reduced: `200ms`.
- Hero wipe: `h1 { clip-path: inset(0 100% 0 0); animation: wipe 600ms cubic-bezier(.2,.7,.2,1) forwards }`; reduced: no animation. Text visible to LCP? `clip-path` does not exclude the element from LCP; but to be safe the title block paragraph (unclipped) is also a candidate.

## 7. Content and data
Zod schemas for `WorkItem`, `PR`, `Post`, `CvRow`, `BodyDef`, `Copy`, `Holiday`. `fetch-github.ts` writes `generated/github.json` (merged count, closed count, repo metadata); failure → committed file + warning. `bs-date.ts`: Gregorian → Bikram Sambat using a committed year table (1970-2100 BS) with unit tests against known dates; `holidays.json` ported from the owner's spatie PR for the current BS year(s), schema-validated, each holiday with a source. Years in copy as "since 2019"; rev line from build date.

## 8. Head, SEO
Title `nihal maskey · lead engineer, kathmandu`; description; canonical; OG/Twitter; `theme-color #1F3FE0`; JSON-LD `Person`; robots; sitemap (`/`, `/sent` excluded via noindex); manifest. No font preload: Chromium and WebKit disagree on `crossorigin` for font preloads, so any static preload double-downloads in one engine (measured in A-13 r2). `font-display: swap` + `size-adjust` fallbacks from `@capsizecss/metrics` keep CLS 0; each woff2 is requested once. Analytics: `import { inject } from '@vercel/analytics'` in a hoisted script after a `navigator.doNotTrack !== '1'` check.

## 9. CSP and headers (`scripts/write-vercel-json.ts`, postbuild)
Reads `dist/**/*.html`, sha256 of every inline `<script>`, writes `vercel.json`:
```
Content-Security-Policy: default-src 'self'; script-src 'self' 'wasm-unsafe-eval' 'sha256-…' https://va.vercel-scripts.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self' https://formspree.io; frame-src https://maskeynihal.github.io; form-action 'self' https://formspree.io; worker-src 'self' blob:; media-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'
Cache-Control: /_astro/* immutable 1y; /fonts/* 1y (hashed names); /sounds/* 1w
X-Content-Type-Options: nosniff; Referrer-Policy: strict-origin-when-cross-origin; Permissions-Policy: camera=(), microphone=(), geolocation=()
```
Iframe: `sandbox="allow-scripts allow-same-origin"` is safe only because the game stays cross-origin on github.io; documented in `ArcadePanel`.

## 10. Budgets (enforced by size-limit on `dist`, brotli)
| Chunk | Budget |
|---|---|
| Initial JS (document + islands runtime + ContactForm + scripts) | ≤ 100 KB |
| `desk-vendor` + Scene | ≤ 320 KB |
| Models total | ≤ 150 KB |
| `physics` | set by E-11 (expected 650-800 KB); loads on grab only |
| Fonts total | ≤ 130 KB |
| First view, mobile, before physics | ≤ 900 KB |
Lighthouse CI (mobile, `staticDistDir`, 3 runs): perf ≥ 0.9, LCP ≤ 2000, CLS ≤ 0.05, TBT ≤ 150, LCP element is text inside `#desk`.

## 11. Testing
Harness (A-08): `playwright.config.ts` projects `desktop-chromium` (`channel: 'chromium'`, args `--use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader`), `mobile-android` (Pixel 7, CDP `Input.dispatchTouchEvent` for drags), `mobile-webkit` (iPhone 14, static asserts only), `reduced-motion`, `no-webgl` (`--disable-webgl --disable-webgl2`), `no-js`. Fixture fails on any console error/warning not in `e2e/console-allowlist.txt` (SwiftShader ReadPixels stall, meshopt decoder notice). `PUBLIC_TEST_HOOKS=1 astro build` exposes `window.__hooks` (base: `ready`, `longTasks`); the desk adds `window.__hooks.desk` (`ready`, `positions()`, `teleport(id, p)`, `grab(id)`, `release(v)`, `lost()`, `frames`, `audio`, `longTasks` via buffered `PerformanceObserver`). `pnpm review <ticket>` builds, previews, runs `--grep @<ticket>`, writes report + screenshots to `playwright-report/` (CI artifact, not git).

Unit: `prefs` matrix; `time` DST edges; `bs-date` known dates; `copy-gate` fixtures + allowlist; schemas; `Oled.frame(n)` snapshots; `ContactForm`; `anchors` map.

E2E per ticket (tags): desk (poster first; canvas after idle; `ready`; drag changes position; throw stays in bounds; teleport → respawn ≤ 2 s; tap navigates and focuses heading; `R` and button reset; callouts are DOM nodes; labels at rest 0.5 opacity; touch: pan scrolls page, press-hold grabs), index (`aria-current` follows midline; keyboard reaches everything; skip link), contact (copy → "copied" + clipboard; validation; mocked 200/500; no-JS native post to Formspree with `_next`), a11y (axe 0 in all projects; focus visible screenshots; poster `inert` when canvas live; object list focus-within visible), reduced-motion (no canvas; no running animations except ScrollTimeline-driven progress and opacity ≤ 200 ms; `getAnimations()` filtered), no-webgl (poster, "3D is off" line, zero console errors), no-js (all sections readable; links; form native; clocks print zone names), visual (3 viewports, canvas masked, `maxDiffPixelRatio 0.015`, baselines from the CI Docker image), mobile (object list 44 px; bottom index; `scrollWidth === innerWidth` at 320), perf smoke (no long task > 100 ms during a 5 s drag; heap growth after 5× mount/unmount < 10 MB; `renderer.info.memory` back to baseline).

Manual gates before release: real iPhone Safari, real Android Chrome, Firefox, Safari desktop, VoiceOver, NVDA, 400% zoom, high contrast, print, 5-minute iOS play without context loss.

## 12. CI
Jobs: `lint` (eslint + prettier + `astro check` + tsc), `unit`, `copy-gate`, `build` (plain) + `build:e2e` (hooks) as artifacts, `check-initial-graph`, `size-limit`, `e2e` matrix (6 projects on `build:e2e` + `astro preview`), `lhci` (plain build, `staticDistDir`), `links`. All required. Vercel preview comment on PR.

## 13. Deploy
Vercel static (no adapter), framework Astro, `vercel.json` generated at build. Node version per Vercel support. Domain unchanged. Branch `rebuild/blueprint` from `main`; first commit clears everything except `.git`, `docs/`, `.gitignore` (rewritten to include `playwright-report/`, `test-results/`, `.DS_Store`). Epic PRs merge into `rebuild/blueprint`; final PR to `main`.

## 14. Risks
| Risk | Mitigation |
|---|---|
| iOS context loss | one canvas, DPR 1 on phones, ≤ 8k tris, one 128×64 texture, dispose, poster on loss, 5-min soak test |
| Rapier size | on-grab only; E-11 picks compat vs real wasm; never in first view |
| Line AA on 1x phones | `LineMaterial` AA + `alphaToCoverage`; hull width in CSS px; review on a real 1x device |
| Detailed models late | D-02 grey-box GLBs from code; finals swap behind same ids; poster regenerates from the same data |
| BS calendar correctness | committed table + unit tests vs known dates; holidays shown only when data covers the year |
| Astro island ↔ DOM | custom events `nihal:navigate`, `nihal:reset`, `nihal:drag`; one scroll owner |
| CLS from fonts | `size-adjust` fallbacks, no preload (A-13 r2); hero text never `opacity:0`; lhci on Linux CI re-checks CLS |
| Formspree down | network error copy with the email; native action still works |
| GitHub API limit | committed snapshot |
| Copy gate noise | prose-only scope; allowlist |
