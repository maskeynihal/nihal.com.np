# v3.2 owner feedback

Source: owner's 16 numbered items, 2026-11-07. Items 17 and 18 were blank. This spec is the brief for four
implementers. Each workstream runs in its own worktree. Read `docs/process/build-brief.md` for house rules.

Rules for all workstreams:

- Keep the site static and SEO-friendly. Keep the look: line art on the blueprint sheet.
- Honour reduced motion, keyboard use and `prefers-color-scheme`. Keep CLS at 0.
- Where you remove visible instructions, keep the action reachable by keyboard and screen reader.
- Update unit tests and e2e specs that assert changed behaviour. Do not weaken an assertion to pass.
- During the work run `pnpm lint`, `pnpm typecheck` and the unit tests for the files you touched. Do not run
  `review:all` or `lhci`. A final pass does that after the merge.
- Look at your result once in a browser (build-mode `PUBLIC_TEST_HOOKS=1` gives `window.__hooks`). Use your own
  port, never 4321.
- Do not push. Commit with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## P: page, copy, hero, scrolling (items 1, 8, 9, 11, 12, 13, 14, 15, 16)

**P1, hero text stalls (item 1).** `src/styles/sheet.css:286-306` reveals the name and title block with a
`clip-path` wipe. `clip-path` animates on the main thread, so it can stall while the desk loads. The wipe now
starts 50 % clipped, so a stall shows half-drawn text. First confirm this: load a production build with 4x CPU
throttle and record what the hero does for the first 5 s. Check fonts too. Then remove what stalls. Default fix:
the title block paints complete with no wipe. Any entrance left must not depend on the main thread (opacity or
transform only) and must not make LCP worse. Also check that the time slot in the title block (blank until the
script runs) does not read as stuck. LCP must stay the `h1` or the sentence, under 1.5 s in lhci.

**P2, remove copy (items 8, 11, 15).**

- Colophon `built` line: "Built with Astro and three.js...".
- `cv.intro` and `cv.note`, and their paragraphs in `index.astro`.
- Open source intro ("Pull requests merged...") and footer ("{merged} merged...").

Remove the now-unused keys and schema fields.

**P3, colophon (item 9).** Not required. Replace the section with a plain footer in a `<footer>`: copyright line
and the source link. No "colophon" heading, no index row. Remove it from `src/lib/sections.ts`, `copy.ts` and the
specs. Keep the sheet close. The garden is then the last section. The last index row is `contact`.

**P4, index row in the garden.** The garden has no index row. With colophon gone, keep `contact` current through
the garden and footer. `atBottom` in `sheet-index.ts` must not break this.

**P5, CV bullets (item 12).** Give CV duties a visible marker in the sheet style, such as a short drawn tick or
dash in the accent colour. Keep them as real `<ul>/<li>`, aligned and hanging. Works on both themes and at 320 px.

**P6, quiet visuals in empty columns (item 13).** Sections use `side="left"` or `side="right"`, which leaves half
the sheet empty at desktop widths. Add one inline SVG line drawing per section in the empty column, in the same
hand as the desk:

- about: a kathmandu skyline or a stupa
- work: a server rack or a flow diagram of queues
- open source: a git branch graph
- writing: a pen and notebook
- cv: a ladder of steps, intern to lead
- contact: a paper plane or an envelope

Low contrast (use `--hair-strong` or similar), `aria-hidden`, no text, no JS. Optional: draw in once on entering
view with a compositor-safe effect, off under reduced motion. Hidden below 1024 px. No layout shift. Keep total
SVG small. They must not read as content or catch the eye over the text.

**P7, smooth index scrolling (item 14).** Clicking an index row jumps. Add a JS-driven eased scroll in
`sheet-index.ts`, with duration about 450 to 700 ms scaled by distance and capped, whatever the page height.

- Highlight the target row at once and hold it for the scroll, so the index does not flicker through rows.
- On arrival, give the section heading a short (about 200 ms) transition.
- User wheel or touch cancels the scroll.
- Update the hash and move focus to the target as the plain anchor does.
- Reduced motion or no JS: plain anchor jump.
- Works in the phone bottom strip too.

**P8, hero sentence (item 16).** Replace the active title-block sentence with exactly:

> Lead engineer at Leapfrog Technology, where my team builds a US behavioural-health platform on AWS. Co-founder of
> Daboo Spaces, a coworking space in Sankhamul, Kathmandu. This site collects my work, open-source contributions and
> writing.

Check how `copy.ts` picks variants A and B, and drop the unused one if nothing needs it. Check meta descriptions
still make sense, and keep the agreed SEO keywords.

## D: desk (items 2, 4, 5)

**D1, no visible instructions (item 2).** Remove `dragHint` from `copy.ts` and its element, including the spot
under the table on the first screen. Keep the visually hidden object list for keyboard and screen readers. Let
play be guessed from motion instead: `grab` cursor on objects and the existing hover response. Add one small
unprompted nudge after first paint, such as the small ball rolling a few px or one object settling, once per
visit, off under reduced motion. "Put everything back" stays: it is recovery, not an instruction.

**D2, gravity (item 4).** The owner says the table's gravity feels off. Do not guess. Read gravity, scale and
materials in `physics-world.tsx`, `fall-world.tsx`, `src/lib/desk/materials.ts`, `fall.ts` and `drag.ts`, then
measure:

- World size of the table in units and the real-world size it implies (assume a table about 1.2 m wide). Whether
  gravity matches that scale. A mismatch is the usual reason things feel floaty.
- Time for an object to fall from drag height to the table, and from the table edge to the viewport floor.
- Bounce count and time to rest per material. Sliding after release. Whether heavy objects tip, or hover or sink
  on the slab.

Fix so that small drops land in about 0.25 to 0.35 s, heavy objects land with a thud and barely bounce, balls
bounce and roll, nothing floats or slides as if on ice. Both worlds must use one source of gravity and materials,
so handoff to the fall layer does not change the feel. Put tuning values in one file with comments. Report before
and after numbers.

Also fix the hard sideways throw if the same work allows it: the object leaves the screen before handoff and
snaps back 200+ px. Hand off earlier (at the canvas edge, not the screen edge) or keep its true position.

**D3, scroll motion (item 5).** Objects on the table move a little with scroll speed: faster scroll, more motion.
Per-object spring, not a rigid group move. Light things (balls, pac-men) shift and tilt more than heavy ones
(laptop). Add per-object damped spring in a pivot wrapper, driven by scroll velocity, with no permanent drift and
a low clamp (a few px on screen). It must work before physics loads, so it must not pull in the physics chunk. It
must not fight drag or physics bodies. No page-level canvas transform. Off under reduced motion and when the
canvas is offscreen. Must not add meaningful main-thread cost.

## L: hanging lamp (item 3)

Replace `ThemeToggle` with a hanging lamp: a line-art shade and bulb on a cord from the top of the sheet, fixed at
the top right inside the border, plus a pull cord. Owner's words: "different level of brightness on the lamp" and
"start to make website darkening as controlled by lamp".

**Levels.** Five, brightest to darkest. Lamp bright means bright page.

| `data-lamp` | Theme   | Look                                        |
|-------------|---------|---------------------------------------------|
| 4           | `paper` | current light mode                          |
| 3           | `paper` | paper dimmed slightly                       |
| 2           | `paper` | dusk paper, clearly darker, ink stays navy  |
| 1           | `blue`  | current blue sheet                          |
| 0           | `blue`  | lamp off, night: much darker blue           |

Give each level an explicit token set in `tokens.css`. Do not interpolate between cream and blue: mid values go
muddy and fail contrast. Check WCAG AA contrast by calculation on every level for `--ink`, `--ink-soft`, panel ink
and links. Keep `data-theme` as `blue` or `paper`, so the existing contract and `nihal:theme` still work. Add
`data-lamp`, and fire `nihal:lamp` on each change. Colour change transitions in about 300 ms, off under reduced
motion. Check desk canvases and the garden stay correct when the level changes inside one theme.

**Interaction.**

- Drag the cord or the lamp down or up: changes level step by step, with a tiny tick at each, and the cord
  stretches and springs back.
- Click or tap the cord: next dimmer level, wrapping from 0 to 4.
- The lamp swings on pull with a short damped swing. Bulb and glow match the level: off at 0, strongest at 4. A
  soft pool of light below the lamp (a radial gradient, no blend modes over the whole page).
- Keyboard and AT: `role="slider"`, `aria-label="lamp brightness"`, `aria-valuemin=0`, `aria-valuemax=4`,
  `aria-valuetext` naming the level, arrows and Home/End. Visible focus. Touch target at least 44 px.
- No text label on the lamp. Under reduced motion: no swing, level still changes.

**Prefs.** Save the level through `src/lib/prefs.ts`. Apply it before first paint in `src/lib/prefs-inline.js`, so
no flash. Update the CSP hash if the build needs it. Default follows the OS: dark gives 1, light gives 4, until
chosen. No JS: lamp hidden, OS default applies.

**Layout.** Must not overlap text in the title block at 320, 390, 768, 1280 and 1440. Smaller on phones. Not in
print. Keep first-load JS under budget; it is plain script and SVG, no React.

Update `e2e/v3-theme.spec.ts` and `prefs` tests to the new control.

## G: garden (items 6, 7, 10)

**G1, no text instructions (item 6).** Remove the buttons' text ("pick a flower", "throw a ball", "start a new
bouquet") and the caption ("the garden. pick flowers..."). Replace them with small line-drawn icon buttons, with
no visible words: a flower, a ball, and a fresh start for the bucket. Low emphasis, `aria-label` kept, visible
focus, 44 px target. Keep the count for screen readers only. The garden should invite touch itself: flowers
lean to the pointer, the cursor is a hand over things you can take, the ball rests in the grass.

**G2, wrap and place the bouquet (item 7).** After picking:

1. With 3 or more flowers in the bucket, a sheet of wrapping paper appears on the ground by the bucket, with no
   words. The user drags the paper onto the bucket (or taps it).
2. Short animation: flowers lift out, paper folds round the stems, a ribbon ties. The result is one bouquet object
   that can be dragged.
3. The user places the bouquet by dragging:
   - **In the vase**: a line-drawn vase stands in the garden. Dropping on or near it stands the bouquet in the
     vase, with the paper removed or tucked. Stays there.
   - **On the edge of the screen**: dropping near a viewport edge pins it there, tilted, in a small fixed element
     that stays while the page scrolls. It sits inside the sheet border, does not cover the index or lamp, and is
     `pointer-events` only on itself. Dragging or tapping it brings it back to the garden.
4. The bucket is then free for a new bunch. Allow several bouquets but cap them (about 3).

Keep the bouquet placement in `localStorage` wrapped in try/catch, as a convenience, and render correctly without
it. Keyboard and AT: focusable controls with `aria-label` for wrap, put in vase, pin to edge and take back. Announce
through the existing live region. Reduced motion: no animation, same results. Pinned element uses no text and must
not cause layout shift.

**G3, dog and ball (item 10).** The owner says the dog picking up the ball is wrong. Read `dogs.ts` and watch it
frame by frame, then fix these:

- The dog runs to where the ball actually is, tracking it while it still rolls, and stops with its mouth at the
  ball, not its body.
- It lowers its head to the ball, takes it with a short pause, and the ball then stays attached to a mouth anchor
  computed from the head pose, facing the right way on both directions and both dog sizes.
- It carries the ball with its head up, returns, sets the ball down by lowering its head, and the ball rests on
  the ground. A little joy afterwards. The ball can be grabbed again.
- If the user grabs the ball during any of this, the dog gives up cleanly, without a jump.

**Budget.** Garden chunk limit is 12 kB br, now 9.19 kB. If G2 cannot fit, raise it in `.size-limit.json` only as
far as needed, up to 15 kB, and say so.
