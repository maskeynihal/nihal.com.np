# Research 01: 3D, scroll, interaction tech (state as of 2026-11-05)

Source: research subagent, versions read from npm/GitHub on 2026-11-05. Blog claims marked secondary.

## 1. 3D on the web

- **three.js** `0.187.0` (r187, 30 Oct 2026). Tree-shaken WebGL core ~150-170 KB gzip (estimate, measure). r185-r187 dominated by WebGPURenderer work.
- **WebGPURenderer / TSL**: WebGPU backend with automatic WebGL2 fallback (`forceWebGL: true` to test). Manual still says WebGLRenderer is "recommended for pure WebGL 2 applications". Browser WebGPU: Chrome 113+, Safari 26 (Sept 2025), Firefox 141 Win / 145 macOS; Linux/Android partial. Verdict for a one-person portfolio: **WebGLRenderer + GLSL is lower-risk**. WebGPU only if compute particles needed.
- **React Three Fiber** `9.8.2` (15 Oct 2026), React 19 line. 9.8.2 fixed `frameloop="demand"` removal bug, DPR on display move, portal leaks. **v10 alpha** makes WebGPU default; do not ship.
- **drei** `10.7.9`. Useful: `ScrollControls`/`useScroll`, `Html`, `View`, `Text`, `MeshTransmissionMaterial`, `Environment`, `PerformanceMonitor`, `AdaptiveDpr`, `Preload`, `useGLTF` (Draco/meshopt/KTX2), `Float`.
- **Spline** runtime heavy (1+ MB JS + scene), closed to perf tuning. Hero-only if at all. **Avoid.**
- **Rive** 2D vector state machines, good for mascots/buttons. Not 3D.
- **Theatre.js** stalled (last public release Aug 2023). **Avoid.** Use GSAP timelines driving R3F refs instead.
- **iOS constraints**: WebKit bugs 289601 / 290623 (2025): WebGL2 context loss under GPU memory pressure, not recoverable until Safari killed. Mitigations: **one canvas per page**, textures <= 1024², KTX2, dispose on unmount, handle `webglcontextlost` (preventDefault) + `webglcontextrestored`, cap DPR 1.5 mobile, static poster fallback. `frameloop="demand"`, pause on `document.hidden` and offscreen.
- **Canvas 3D vs CSS 3D**: CSS `perspective`/`rotate3d` for cards, flips, parallax, 3D text: accessible, zero bundle, SEO-visible. WebGL only for lighting, materials, meshes, particles, shaders, physics. Standard award pattern: DOM content + one background canvas synced via `drei/View`.

## 2. Physics

- **Rapier** via `@react-three/rapier@2.2.0` (rapier 0.19.2). Maintained. WASM ~500-600 KB gzip (estimate). Async init; Suspense.
- **cannon-es** dead (2022). **Matter.js** 0.20.0 (2024), stable for 2D DOM toys.
- Pitfalls: fixed timestep 1/60 + interpolation; no cross-CPU determinism unless deterministic build; **wake sleeping bodies before impulse**; <= 100-200 dynamic bodies on mobile, primitive colliders only; `paused` when offscreen; physics needs continuous frames while awake, so `frameloop="always"` only while interaction active, else `invalidate()`.

## 3. Scroll

- **GSAP** `3.15.1`, fully free incl. ScrollTrigger, SplitText, MorphSVG, DrawSVG, ScrollSmoother (Webflow acquisition). `gsap.matchMedia()` for reduced motion; `useGSAP()` from `@gsap/react`. Best tool for scrub/pin and driving three.js camera.
- **Lenis** `1.3.27`; 1.3.26 added native `prefers-reduced-motion`. No scroll-snap; disable on touch (`syncTouch: false`).
- **Motion** `14.9.1` (`motion/react`): `useScroll`, `whileInView`, `drag`. Lighter for component motion; weaker for pin/scrub.
- **CSS scroll-driven animations** (`animation-timeline: scroll()/view()`): Chrome 115+, Safari 26, Firefox 159+; ~89% global. Off main thread: zero INP. Use for progress bars, reveals, DOM parallax with `@supports` and un-animated baseline.
- **Accessibility**: scrolljacking criticized; smooth-scroll libs break skip links/focus. Rules: never alter scroll speed/direction under reduced motion; all content Tab-reachable; pinned sections must not trap keyboard; animate only `transform`/`opacity`; WCAG 2.3.3 and 2.2.2 (pause anything auto-moving > 5 s).

## 4. Interaction patterns

| Pattern | Implementation | Cost | A11y / fallback |
|---|---|---|---|
| Cursor-following object | pointer -> lerped target in `useFrame` or `gsap.quickTo`; window listener | Low | Hide on `(hover: none)`; no-op reduced motion |
| Drag-and-throw physics | rapier `RigidBody` + `@use-gesture/react`; kinematic while dragging; `applyImpulse` from pointer velocity; `wakeUp()` | Medium | Keyboard shuffle/reset buttons; `aria-hidden` canvas; content in DOM |
| Magnetic buttons | padded hit area + `quickTo` translate | Negligible | Off on touch and reduced motion; focus ring stays |
| Hover distortion shaders | `shaderMaterial` uniform `uHover`, lerp in `useFrame`, `drei/Image` | Medium (pixel area x DPR) | Real `<img>` in DOM; static when no WebGL |
| Text scramble | SplitText chars + random for N frames; fixed width | Low | Final text in SSR HTML; `aria-label` final string |
| Draggable cards | Motion `drag` + constraints | Low | Focusable, arrow-key reorder or list view |
| Mini games | 2D canvas / Matter.js, lazy on click | Medium while active | Keyboard controls, pause control, SR text |
| Easter eggs | keydown buffer; `console.log('%c')` | None | Never gate essential content |
| Sound toggle | AudioContext on first gesture; default **off**; localStorage | Low | `aria-pressed`; never autoplay |

## 5. Performance budgets

- CWV p75: **LCP <= 2.5 s, INP <= 200 ms, CLS <= 0.1**.
- Initial JS <= ~150 KB gzip before three; three+R3F+drei lazy chunk ~250-350 KB gzip; rapier +~500 KB lazy.
- **LCP element must be DOM** (hero text / poster), never canvas. Mount canvas after idle / IntersectionObserver via dynamic import.
- INP: no setState in `useFrame`; refs only; async loaders with worker decoders; WASM init off critical path.
- CLS: reserve canvas via `aspect-ratio`; `font-display: optional` or `size-adjust`; fixed line heights for SplitText.
- Assets: `gltf-transform optimize` (meshopt), KTX2 textures, one codec; small HDR.
- R3F knobs: `<Canvas frameloop="demand" dpr={[1,1.5]}>`, `PerformanceMonitor onDecline`, `AdaptiveDpr`, instancing, shared materials. Pause on `document.hidden`.

## 6. Framework

- **Next.js 16.4** (6 Oct 2026, React 19.3, Turbopack). `output: 'export'` works; export disables image optimization/middleware/ISR. Pros: metadata, `next/font`, `next/dynamic`, Vercel. Cons: React runtime on every page, RSC overhead wasted, `'use client'` juggling.
- **Astro 7.4.5**: islands, `client:visible` = load-3D-on-intersection for free, React 19 via `@astrojs/react`. Best LCP/SEO. Cons: cross-island state needs nanostores or one big island.
- **Vite 8 SPA**: fastest DX, weak SEO without prerender.
- Recommendation from research: Astro + React islands, or Next 16 static export if Vercel/React conveniences wanted. No SSR needed.

## 7. Testing

- Playwright `toHaveScreenshot()` freezes CSS/WAAPI animations, not canvas. Expose `window.__ready` after first render + deterministic seed; `maxDiffPixelRatio` 0.01-0.02.
- Headless WebGL on Linux CI: `--use-gl=angle --use-angle=swiftshader`. Generate baselines on same backend (Docker). Also run with `--disable-webgl` to verify poster fallback.
- Reduced-motion Playwright project: `reducedMotion: 'reduce'`; assert no smooth-scroll class, hero text visible at t=0, no transform animation.
- Lighthouse CI: performance >= 0.9, LCP <= 2500, CLS <= 0.1, TBT <= 200, script budget <= 300 KB initial. Mobile emulation. Field data via `web-vitals`/Speed Insights.

## Key uncertainties
- GitHub release years inferred. WebGPU production readiness contested. Safari `requestIdleCallback`/OffscreenCanvas-WebGL status unverified. Firefox scroll-driven ship version (caniuse: 159).
