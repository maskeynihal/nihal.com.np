# v3.3 owner feedback

Source: owner's nine points on the v3.2 work, 2026-11-07, with screenshots of the empty side column at lamp level 0
and the phone table. Builds on `docs/specs/06-v3-2-feedback.md`. Read `docs/process/build-brief.md` for house rules.

Rules for all workstreams:

- Keep the site static and SEO-friendly, and keep the line-art look.
- Honour reduced motion and keyboard use. Keep CLS at 0. Do not grow the physics chunk (628.38 of 640 kB br).
- Update tests and specs that assert changed behaviour. Do not weaken an assertion to pass; if you loosen one, say why.
- Run lint, typecheck and unit tests for what you touched. Do not run `review:all` or `lhci`; a final pass does that.
- **Look at the real result in a browser and open your screenshots.** The owner has twice found problems that passing
  tests missed. Report what you saw, not only what tests say. Use your own ports, never 4321, and stop servers you start.
- The agent worktree may be cut from `main` (old site). Check first: `git merge-base --is-ancestor c3acc92 HEAD`. If it
  fails and you have no commits, run `git reset --hard rebuild/blueprint` on your own branch, then `pnpm install`.
- Do not push. Commit with the trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## T: table

**T1, no labels.** Remove all visible labels on table objects: KTM, BIKRAM SAMBAT, UNO R4, CANVAS 2020, DEMO VALUES,
their leader lines and any hover callouts, in the live scene and in the poster. Remove code this leaves unused
(`Callouts.tsx`, `nihal:callout`, `src/lib/desk/callouts.ts`) where nothing else needs it. The visually hidden object
list stays. Its entry for the board must say the OLED readings are demo values, so the fact stays available to screen
readers.

**T2, reset is an icon.** "Put everything back" becomes a small icon-only button: a circular arrow in the same line
weight as the sheet. No visible text. `aria-label="put everything back"`, 44 px target, visible focus, inside the sheet
border, low emphasis, and above the phone strip. It must not hide resting objects: lift the button clear or place it so
it does not sit on the floor line where objects land.

**T3, scroll motion, redo.** The owner rejected the D3 result, and in the phone screenshot pac-man and a ball sit visibly
tilted. First check whether objects are left rotated at rest: the owner's screenshot may show a stuck offset, a tilt about
the wrong pivot, or just the design. Then replace the design:

- Treat a scroll as a nudge to the table: every object slides a little along the table plane, opposite to the scroll
  direction, and eases back.
- Motion scales with scroll speed and with lightness: balls most, pac-men and ghost less, laptop and board barely.
- Balls roll to match the distance they slide. **Nothing else rotates.** No tilt.
- Smooth the velocity, so wheel steps do not read as jerks. Spring near critical damping, with one small overshoot at
  most. Cap about 6 px on screen.
- Exactly zero offset and zero rotation at rest, checked by reading transforms after scrolling stops.
- Still no physics chunk before first grab, off under reduced motion and offscreen, and no effect on held or free bodies.

Drive it with real wheel input (`page.mouse.wheel` many small steps, not `scrollTo`) in a headed or GPU-capable run if
available, and capture a frame sequence. SwiftShader delivers scroll events about every 150 ms, so also test the spring
in unit tests at 60 Hz. Say plainly what you could not judge.

**T4, phone table fits.** The table does not fit on a phone: 135 % drawing, objects clipped at left, right side cut. At
every width under 768 px the whole table, all edges and all objects sit inside the sheet with no clipping and no
horizontal overflow. Remove the 135 % rule and `overflow-x: clip`. To keep objects large enough, frame the camera for
portrait, steeper and closer, rather than scaling a wide view. The poster must match the live first frame at phone widths
so there is no jump. Regenerate with `pnpm assets` if poster or models change. Check 320, 390 and 402 by eye.

**T5, fewer objects on phone.** Under 768 px show fewer objects, so the table is not cluttered: drop the small balls
and keep about 8 readable ones (your pick, say which). Dropped objects are not rendered and not in physics at that
width. The hidden object list matches. Handle a rotate or resize across 768 px without errors.

## G: garden

**G1, bouquet and vase fall to the bottom of the screen.** Like objects falling off the table, the owner wants to place
them at the end of the screen.

- The bouquet and the vase are both draggable, including outside the garden while dragging.
- Let go inside the garden: as now (bouquet on grass, or in the vase).
- Let go outside the garden: it falls with gravity to the bottom of the viewport and rests there, staying put while the
  page scrolls. One small bounce. Use the same floor as the desk fall layer (`--inset`, `--strip-h` tokens), and the same
  gravity feel (read `src/lib/desk/materials.ts` values). Plain JS, no rapier, no React.
- A bouquet in the vase moves with the vase. Dropped vases stand upright. Items side by side do not overlap (simple
  x separation is enough).
- Dragging or tapping a rested item picks it up again. Dropping it back in the garden returns it.
- This replaces the edge pin from v3.2. Remove `pins.ts` behaviour that no longer applies and keep the code small.
- Keep the fixed layer small, off the left index, the lamp and the reset button. `pointer-events` only on items.
- Keep `localStorage` placement in try/catch. Reappears on reload without waiting for the garden to scroll into view if
  that fits the budget; if not, say so.
- Keyboard and AT: focusable controls and `aria-label`s for "drop to the bottom of the screen" and "bring back".
  Announce through the live region. Reduced motion: no fall animation, same result.

**G2, dogs follow the ball.** The owner reports the dog is not following the ball, after a fix that passed its spec, so
the spec does not cover what the owner does. Reproduce with real pointer input on the merged build: grab the ball and
throw it hard, throw it softly, drop it, throw repeatedly, throw while both dogs are busy, use the ball icon, click the
ball where it rests. Check `b.fetch`, `b.claimed`, the `assign` logic and the 12 s give-up. Likely faults: a ball that is
never marked fetchable, a dog stuck claiming a ball, no re-assign after giving up, the dog aiming at where the ball was.
Fix so any free ball on the ground or rolling gets chased while a dog is free; when both are busy it waits and is
chased next. Add an e2e test using real pointer drags, not hooks.

**G3, max 4 balls.** At most 4 balls exist. A fifth removes the oldest free one with a small fade or shrink. A ball held
or carried is never removed.

Budget: garden chunk 13.31 of 14 kB br. Raise only as needed, to 16 kB at most, and say so.

## S: side columns, naming, phone clutter

**S1, side columns have life.** The owner's screenshot: a small server rack at the top, then a tall empty column. Rework
`SectionArt`:

- Each drawing stays in view through its section (`position: sticky`, centred vertically), so the column is never empty
  at desktop widths. It must not overlap the next section's content or run past the section end.
- Add very slow, very subtle motion per drawing, compositor-only (`transform`, `opacity`), CSS only if possible:
  rack LED blink, branch graph dot travelling, pen drift, plane drift, a ladder rung lighting up, prayer flags moving.
- Add a small response to the pointer: slight parallax when the pointer moves over the column, and one small reaction on
  hover or click (LED toggles, plane hops). Plain script, loaded lazily, little JS. No text, `aria-hidden`.
- Very quiet: low-contrast strokes. Must never pull attention from the text. Check all five lamp levels, including 0,
  where the owner looked. Off under reduced motion. Paused offscreen. Hidden below 1024 px.

**S2, "Work" becomes "Projects".** The section lists things the owner built. Employment is in the CV. Rename the heading,
index row, section id (`#projects`), the `skipTo` target, "see the work" to "see the projects", and every spec. Check
copy for other mentions of this section and leave phrases about employment ("work with people") alone. SEO keywords stay.

**S3, phone clutter.** Under 768 px:

- Bottom strip: show 4 rows that fit without sideways scrolling: about, projects, cv, contact. Remove the sideways scroll.
  When an omitted section is on screen, no row or the nearest earlier row is current; choose one and say which. Desk,
  open source and writing are still reached by scrolling.
- Title block: drop the "REV / SHEET / SCALE" line. Keep name, role line, sentence, email, the link and the clock line.
  Put "reduce motion" and "sound" in one low-emphasis row, or move them to the footer if that is tidier. Reduce the
  block's height so the table starts higher.
- Footer: check it is tidy at 320 and 390.

**S4, lamp contrast on WebKit.** `e2e/v3-theme.spec.ts`, "every level has no axe violations", fails 4 of 4 on mobile-webkit
at level 4 with contrast violations across the page. This is unresolved and may be a real bug. Find out whether axe
samples colours during the 300 ms fade or whether WebKit really shows wrong colours at level 4. If it is timing, wait for
the fade in the test and confirm the settled colours by reading them. If real, fix it.
