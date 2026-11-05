# Tickets v2

Status: v2. Date 2026-11-05. Restructured per `reviews/plan-critique-02-engineering.md` (A-08..A-12, D-06, E-11 added; E-05/06/10 merged; B-06 split; budgets moved to E-11/F-02). Each ticket: deps, acceptance (observable), verify (reviewer's proof), spec tag for Playwright (`@A-01` etc.).

## Definition of Done (every ticket)
- `pnpm lint && pnpm typecheck && pnpm test && pnpm build && pnpm check:graph` green locally and in CI.
- The ticket adds or updates its own Playwright spec, tagged with its ID, passing in every applicable project.
- Zero console errors/warnings outside `e2e/console-allowlist.txt`.
- Copy gate green. Design slop gate (`01-design-spec.md` §10) checked against the ticket's screenshots.
- Reviewer ran `pnpm review <ID>` and wrote `docs/reviews/<ID>-r<N>.md` with `VERDICT: Ready to Ship`.

---

## Epic A: Foundation (PR 1)

### A-01 Scaffold and clear
Deps: none. Branch `rebuild/blueprint` from `main`; remove everything but `.git`, `docs/`; `.gitignore` rewritten (node_modules, dist, .astro, playwright-report, test-results, .DS_Store, .vercel, .env*); Astro 7 + `@astrojs/react` + Tailwind v4 + TS strict; eslint (astro, react, react-hooks, jsx-a11y) + prettier; `.nvmrc` 24; `index.astro` renders `nihal maskey` on blue. Verify: build output; `git ls-files` shows no legacy; lint 0.

### A-08 Test and review harness
Deps: A-01. Vitest config; Playwright config with 6 projects (`desktop-chromium` channel chromium + SwiftShader flags incl. `--enable-unsafe-swiftshader`, `mobile-android`, `mobile-webkit`, `reduced-motion`, `no-webgl`, `no-js`); console-fail fixture + allowlist file; `PUBLIC_TEST_HOOKS` build mode (`pnpm build:e2e`) exposing `window.__hooks` namespace; `pnpm review <ID>` runner (build:e2e → preview → `--grep @<ID>` → report dir printed); `e2e/smoke.spec.ts` (@A-08) passes in all 6; `playwright install --with-deps` in CI; `lighthouserc.cjs` on `staticDistDir`; `scripts/check-initial-graph.ts` (`pnpm check:graph`) with a fixture proving it fails when a chunk matching `desk-vendor|physics` is reachable from the initial graph. Verify: CI run with all 6 projects green; graph check fails on the fixture, passes on the real build.

### A-02 Tokens, fonts, global styles
Deps: A-01. Carry-over from A-01 review: remove Google Fonts link (self-host); single source of tokens (`@theme inline` pointing at the `:root` vars, no duplicate values); switch eslint to `defineConfig` from `eslint/config`. `tokens.css` + `@theme` with every §2.1 token incl. `--line-2 #DED9FA`; Fraunces instanced (`varLib.instancer` SOFT=0 WONK=0:1 wght=400:700 opsz=14:144) + subset latin; JetBrains Mono subset; **no Inter**; `size-adjust` fallbacks from `@capsizecss/metrics`; preload both; type scale; focus rings; `print.css`; `[data-motion]`/`[data-sound]` hooks. Fonts total ≤ 130 KB. Verify: CLS 0 on a text-only page (lhci); font sizes listed; fallback metrics within 2%.

### A-03 Preferences and capability
Deps: A-02. Carry-over from A-02 review: scope or remove the `.hook-transition` CSS rule so it is absent from the plain build. Inline head script (try/catch localStorage) sets `data-motion`, `data-sound`; legacy fragment map; `prefs.ts` with `hasWebGL2` memoised + `loseContext`, `canRun3D`, `dprFor`, `requestIdleCallback` shim; `failIfMajorPerformanceCaveat` disabled under test hooks; toggles flip attributes live + persist. Unit matrix ≥ 24 cases. Verify: Vitest; Playwright @A-03: `reducedMotion: reduce` → attribute present at `domcontentloaded` with no flash (screenshot); `/#projects` → lands on `#work`.

### A-04 Content schema and data
Deps: A-01. Zod schemas (`WorkItem`, `PR`, `Post`, `CvRow`, `BodyDef`, `Copy`, `Holiday`); content files populated from `02-copy.md` v2; `[CONFIRM]`/`[ASK]` items carry `confirmed: false` and are hidden; `fetch-github.ts` + committed `generated/github.json` with failure fallback; build fails on invalid data. Verify: bad-row test fails; build passes; grep for hard-coded years returns none.

### A-05 Copy gate
Deps: A-04. Carry-over from A-04 r2: gate skips `src/content/pending.ts`; harden `check-dist-leaks` to scan every non-binary file in dist (content sniff, not extension allowlist) and to fail on any displayed string of a `confirmed:false` row (work bodies, cv org suffix, object labels/callouts) in the plain build; fix the stale `client-copy.test.ts` comment. Carry-over from A-04 r1: unconfirmed notes live outside displayed content (see A-04 fix), so the gate scans displayed strings only. `scripts/copy-gate.ts` scoped to `src/content/**`, banned list from `02-copy.md` §2, allowlist `DynamoDB`, `Loop Harness`, output `file:line: word`, exit 1; fixtures; CI job. Verify: seeded word fails CI; removed passes.

### A-06 Layout, head, SEO, pages
Deps: A-02, A-04. Carry-over from A-05 r1: copy-gate scans `content` attributes and `application/ld+json`; new dist-HTML gate runs `scanText` over every built page's text nodes, `alt`, `aria-*`, `title`, `placeholder`, meta `content`, `<title>` and JSON-LD string values (catches loop-rendered text the .astro scanner cannot see); unbalanced quotes inside `{...}` in .astro make the scanner fail loudly; inflections (`reaching out`, `leveraged`, `harnessing`, `showcasing`, `streamlined`) caught; content hits print `file:line`; de-duplicate repeated leak reports. `Base.astro` (meta, OG, JSON-LD Person, theme-color, manifest, skip link); `404.astro`, `sent.astro` (noindex); robots; sitemap. Verify: Lighthouse SEO 100; structured-data validator; 404 status on preview.

### A-07 CI workflow
Deps: A-08. Carry-over from A-08 review: `pnpm exec playwright install --with-deps chromium webkit` in CI; e2e job runs via `pnpm review:all` (the only supported Playwright entry). `ci.yml`: lint, unit, copy-gate, build + build:e2e artifacts, check:graph, size-limit, e2e matrix, lhci, links; all required; PR comment with sizes. Verify: PR shows all checks.

### A-09 CSP generation and headers
Deps: A-06. `write-vercel-json.ts` postbuild hashes inline scripts and writes `vercel.json` with the §9 header set incl. `wasm-unsafe-eval`, `va.vercel-scripts.com`, `form-action formspree`; analytics via bundled `inject()` behind DNT. Verify @A-09: zero CSP violations in console on preview with physics loaded (stub), form posted (mocked), game iframe opened.

### A-10 Error boundary and island isolation
Deps: A-03. Error boundary around Desk shell and around Scene (fallback poster + "3D paused"); `client:only="react"`; logging hook. Verify @A-10: hook throws inside Scene → poster shown, no uncaught error.

### A-11 Repo hygiene and docs
Deps: A-01. Carry-over: document why TypeScript is pinned to 6.x (typescript-eslint and astro check lack TS 7 support) in README and a Renovate rule. README rewrite; CONTRIBUTING linking the review loop; Renovate config; CODEOWNERS. Verify: files present; links valid.

### A-12 Project settings and secrets
Deps: A-07. Vercel project (framework Astro, Node version verified), Deployment Protection bypass for lhci if used, branch protection with required checks, `GITHUB_TOKEN` usage documented. Verify: screenshot of settings in review file; protected branch rejects a direct push (dry run).

## Epic B: Static page (PR 2)

### B-01 Sheet border and index
Deps: A-06, A-03. Carry-over from A-03 r3: final toggle placement must not wrap at 375 px under OS reduce (note visible); un-skip/extend the 375 px test for the reduced-motion project; tidy the long header comment in `prefs-inline.js`. Drawn border; left-margin index ≥ 1024 / bottom strip below; rows as links with `aria-current` via midline IO; progress rule via two paths + clip-rect `scaleY(var(--progress))`, `animation-timeline: scroll(root)` with JS fallback; dims to 40% on `nihal:drag`. Verify @B-01: `aria-current` follows scroll on tall sections; keyboard reaches all rows; fallback path exercised in a project with the feature flag off.

### B-02 Section and PaperPanel primitives
Deps: A-02. Carry-over from A-02 review: Playwright guard that every rendered → / ← sits in an element whose computed font-family is JetBrains Mono (Fraunces has no arrow glyphs). Asymmetric grid, rhythm, opacity-only enter. Verify @B-02: visual at 3 viewports; no horizontal scroll at 320.

### B-03 Title block and poster
Deps: B-02, D-01. Carry-over from A-04 r1: rev/sheet/scale line comes from content + build date, not hard-coded in `index.astro`. `TitleBlock` (h1 real text with clip-path wipe, sentence, email copy, live time, rev/sheet/scale from build); inline SVG poster `role=img` ≤ 16 KB; **phone order**: title block → poster/canvas → object list; `ObjectList` single DOM node, visible on phones and `:focus-within`; poster `inert` toggling hook. Verify @B-03: LCP element is text in `#desk` (lhci audit); h1 textContent exact; object list links navigate in no-js and no-webgl projects.

### B-04 Work, open source, writing, cv
Deps: B-02, A-04. Keep poster, object list and visible objects in step (all derive from `getObjects()`). Carry-over from A-04 r1: create anchors `id="work-<id>"` on each work panel (object targets use them); decide how the Trayt panel renders while `confirmed:false` (default: omitted until the owner confirms the client name; the empty-frame treatment applies once confirmed). Five work panels with date lines and marks; Trayt panel as empty frame with filled title block; revision table (`<table>` + caption); writing list; cv table; all readable with no JS. Verify @B-04: no-js project; link check; copy gate.

### B-05 Work-panel marks
Deps: B-04, D-01. One SVG mark per panel, already drawn (no draw-in). Verify: visual; `getAnimations()` empty on marks.

### B-06a Copy email and clocks
Deps: B-02, A-04. `CopyEmail` (vanilla script, clipboard + fallback, live region "copied", 1.6 s); `ClockFace` ×3 (Astro + script, 1/min, tabular numerals; cities from content; server renders zone names). Verify @B-06a: clipboard holds the address; clocks update; no hydration errors (none are React).

### B-06b Contact form
Deps: B-02, A-04, A-09. React island over Formspree: native `action`/`method`, `_gotcha`, `_next=/sent`, inline validation, live-region errors, success/network copy, focus management. Verify @B-06b: mocked 200/500; no-js native post; keyboard-only submit; axe 0.

### B-07 Colophon and sheet close
Deps: B-02. Colophon copy; the border closes the sheet; optional Nepali end mark only if owner confirms. Verify: visual; copy gate.

### B-08 Arcade panel
Deps: B-04, A-09. "play" → sandboxed lazy iframe (cross-origin github.io), title, focus in, Escape returns, direct link; sandbox rationale comment. Verify @B-08: iframe absent before click; Escape path; no CSP violation.

### B-09 Bikram Sambat date and holidays
Deps: A-04. `bs-date.ts` with committed table and unit tests against ≥ 20 known dates; `holidays.json` ported from the owner's spatie PR with sources; used by the calendar object (E-04) and nowhere else. Verify: unit tests; schema.

## Epic C: Motion polish (PR 3)

### C-01 Hero wipe and enters
Deps: B-03. `clip-path` wipe 600 ms; panel opacity enters; all off under reduce. Verify @C-01: reduced-motion project `getAnimations()` filtered empty; CLS 0.

### C-02 Ledger hover leader lines
Deps: B-04. Row hover/focus extends a 24 px leader line 160 ms. Verify: visual hover state; focus-visible screenshot.

### C-03 Object-tap shared callout transition
Deps: E-06, B-04. Tapped object's callout label clones into a fixed layer, travels 600 ms to the section date line, removed on arrival; single scroll owner; reduced motion: plain jump. Verify @C-03: hook `grab`/`release` tap → section focused, clone removed, no duplicate text for SR (clone `aria-hidden`).

## Epic D: Assets (PR 4; D-01 and D-06 start day 1)

### D-01 Line-art set (SVG)
Deps: D-02. Poster generated by `scripts/models/poster.ts`: projects the same crease + silhouette line data as the GLBs through the fixed hero camera into SVG paths (2D and 3D identical by construction); five work marks hand-written SVG; favicon nib; OG composition; 1.5 px structural / 1 px secondary strokes; svgo. Verify: visual review against §2.3; poster ≤ 16 KB; overlay of poster on a canvas screenshot at the same camera differs < 2 px on outlines.

### D-06 Asset pipeline tooling
Deps: A-01. **No Blender** (not installed; decided 2026-11-05). Models are code: `scripts/models/*.ts` build each object from three.js primitives/extrusions in Node, compute crease edges (authored per part: which edges are lines is chosen in code, not by a global threshold), export GLB via `GLTFExporter` with a `LINES` primitive per object, then `gltf-transform optimize --compress meshopt`. `pnpm assets` regenerates everything deterministically. `instance-fonts.sh` (fonttools via `uvx`/`pipx`, documented); svgo config; `docs/process/assets.md`. Verify: `pnpm assets` twice yields byte-identical GLBs; each GLB has a LINES primitive; runs in CI.

### D-02 Grey-box GLBs
Deps: D-06. Sheet + 6 objects from `scripts/models`, correct ids/origins/sizes from `objects.ts`, `LINES` primitive present, ≤ 300 tris each. Verify: scene loads all; size check.

### D-03 Final GLBs
Deps: D-02, owner §12.1. Detailed code-built models (board with headers and OLED frame, clock bezel + feet, calendar with ring binding, ghost with skirt, optional cruiser): ≤ 1.2k tris each, ≤ 8k total, ≤ 150 KB total; creases chosen per part; poster regenerated from them. Verify: screenshots 1x/1.5x desktop/phone framing; no z-fighting; no hairball edges.

### D-04 Sounds
Deps: none. 3 taps + 1 tick, ogg + mp3, ≤ 20 KB, licence in `docs/research/asset-sources.md`. Verify: files, sizes, licence.

### D-05 OG, favicons, manifest
Deps: D-01. Verify: social debugger renders; manifest valid.

## Epic E: The drawing (PR 5)

### E-11 Physics spike and budget
Deps: A-08. Measure `rapier3d-compat` chunk (br, gz) and init time on desktop + Pixel-class emulation; try `@dimforge/rapier3d` real `.wasm` alias + shim; pick one; write the F-02 number. Verify: numbers in `docs/reviews/E-11.md`.

### E-01 Desk island shell
Deps: A-03, A-10, B-03, D-02. `client:only`; shell imports nothing from three (graph check); poster → idle → `lazy(Scene)`; 300 ms crossfade; `aria-hidden` canvas; poster `inert`; reset button; hooks. Canvas `flat`, `alpha:false`, clear blue, `svh` height, `resize debounce`. Verify @E-01: poster first, canvas after; `check:graph` green; LCP unchanged from B-03.

### E-02 Line-art rendering
Deps: E-01, D-02. Occluder + inverted hull + `LineSegments2` creases; shared materials; `resolution` on resize; lines non-raycastable; `near/far` 0.5/8. Verify @E-02: canvas background pixel within ±2 of `#1F3FE0`; hull outline visible on a sphere test object at DPR 1; SwiftShader renders.

### E-03 OLED texture
Deps: E-02. Pure `frame(n)`; 500 ms tick while visible; "demo values" caption; stops when hidden/reduce. Verify: unit snapshots; hook shows ticks stop on `visibilitychange`.

### E-04 Clocks, calendar, ghost (static)
Deps: E-02, B-09. Clock hands 1 s; calendar shows BS date + holiday; ghost static with eyes tracking only while grabbed. Verify @E-04: hook reads hand angles vs `time.ts`; calendar text equals `bs-date` output.

### E-05 Physics world, drag, throw, touch (merged E-05/06/10)
Deps: E-02, E-11, A-09. Registry + imperative reparenting (no flash, bodies start asleep); `objects.ts` defs; 6 static colliders; `useAfterPhysicsStep` invalidate; watchdog; pointer capture; press-hold on touch with `pan-y` + conditional preventDefault; ring-buffer `setLinvel` clamp 4 m/s; tap → `nihal:navigate`; hover lift on mesh; `R` and double-tap reset; index dims on drag; ≤ 7 bodies; phone framing + list. Verify @E-05: desktop drag/throw/tap/reset; android CDP: pan scrolls page, press-hold grabs, drag does not scroll; throw stays in bounds; teleport → respawn ≤ 2 s; bodies asleep → 0 frames over 2 s; no flash on physics load (screenshot diff before/after < 0.5%).

### E-06 Callouts
Deps: E-05. Leader lines + DOM labels on grab; labels at rest 0.5 → 1.0; 160/240 ms. Verify @E-06: labels are DOM nodes with `role=tooltip`; opacity values.

### E-07 Exploded view
Deps: E-01, E-04. Scroll ref + lerp; leader lines; skips awake bodies; converges and stops rendering; off under reduce. Verify @E-07: at 50% scroll hook factor ≈ 0.5; frame counter stops after convergence; no long task > 50 ms during scroll.

### E-08 Sound
Deps: E-05, D-04. Toggle, AudioContext on press only, drops by impact speed, minute tick, mute on hidden. Verify @E-08: `audio === null` while off; drop plays when on.

### E-09 Context loss, disposal, low-end
Deps: E-05. Loss → poster + copy, one restore; unmount disposes (`info.memory` baseline after ×5); low-end triggers → poster. Verify @E-09: `WEBGL_lose_context` path; memory hook.

## Epic F: Quality gates (PR 6)

### F-01 Flake pass and visual baselines
Deps: all B, C, E. Baselines from CI image; canvas masked; 3 consecutive green runs; mobile drag only in `mobile-android`. Verify: CI history.

### F-02 Budgets
Deps: E-11, A-07. size-limit: initial ≤ 100 KB br, desk-vendor ≤ 320 KB, models ≤ 150 KB, physics per E-11, fonts ≤ 130 KB; lhci thresholds. Verify: CI artifacts + PR comment.

### F-03 Accessibility audit
Deps: F-01. axe 0 everywhere; manual VoiceOver/NVDA/zoom/high-contrast pass recorded in `docs/reviews/a11y-manual.md`. Verify: file with evidence.

### F-04 Cross-browser and real devices
Deps: F-01. Safari macOS, iOS real device (5-min soak), Android real device, Firefox, Edge; findings fixed. Verify: `docs/reviews/devices.md`.

### F-05 Release
Deps: F-01..F-04, all [CONFIRM]/[ASK] resolved or cut. PR to `main`; prod deploy; smoke on nihal.com.np; CHANGELOG. Verify: prod Lighthouse; headers via curl.

## Order
Strictly one writer per checkout. A-01 → A-08 → A-02 → A-03 → A-04 → A-05 → A-06 → A-10 → A-11 → A-09 → A-07 → A-12 (A-07/A-12 need owner OK for push, Vercel, branch protection). D-06 → D-02 → D-01 may run in parallel only in an isolated git worktree (touches `scripts/models`, `src/assets` only), merged after review. Then B → B-09 → C-01/02 → E-11 → E-01..E-09 → C-03 → D-03 swap → F.

## DoD waivers
Until A-08 is merged, reviewers waive: tagged Playwright spec, `pnpm test`, `check:graph`, `pnpm review <ID>`. They verify instead with direct commands: build, lint, format, typecheck, preview + curl, `git ls-files`. After A-08: no waivers. Gates that need a person (real devices, VoiceOver, NVDA) are owner gates in F-03/F-04; agents cannot sign them off.
