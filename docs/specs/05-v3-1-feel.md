# v3.1 feel fixes (owner feedback 2026-11-06)

Owner, on the v3 desk: "the previous table was good. It moves a bit when scrolling and the dragging things around the table was smooth on previous.. the additional of falling the object from the table is good but it doesn't feel natural like it fell from the table. and dragging the things around the table also doesn't feel natural".

The v3 desk (fixed full-screen canvas, orthographic camera, depth-locked 2D physics, bodies created per grab) caused all of this. "Previous" means the E-01..E-07 desk at commit 2233c28: canvas inside the figure, perspective `heroCamera`, real 3D rapier world. Read it with `git show 2233c28:<path>`.

## D. Desk
Design: two layers.
1. **Table layer: the previous desk restored.** Canvas back inside the figure, in normal page flow, so the browser scrolls it and it cannot lag or jitter. Perspective camera and the trapezoid table look from 2233c28. Real 3D drag from 2233c28 (same feel), with all bodies created on first grab so a dragged object pushes the others. Restore the tilt while dragging. Keep the table lower than the title block, and the v3 objects (laptop, balls, pac-men, N I H A L), laid out so they fit this view without clutter; enlarge the table if needed. Remove nothing else from that desk except the exploded view, which stays removed.
2. **Fall layer: only when something leaves the table.** The table has no side walls. An object pushed, dragged or thrown past the edge really tips over the edge in the 3D world: it pivots on the rim and starts rotating and dropping, in perspective, with gravity. Once it is below the table top and past the rim, hand it to a lazily mounted fixed full-viewport transparent canvas (`pointer-events: none`), in one frame with no visible jump: same screen position, same apparent size, same orientation, same screen velocity and same angular velocity. There it keeps falling under gravity to the bottom of the screen, with full 3D rotation, and bounces and settles according to its material (balls bounce and roll; laptop and letters thud and tumble little). Side walls and floor are the viewport edges; it stays on screen while the page scrolls. Scroll gives free objects only a small jolt. Do not stick to a depth-locked flat look: it should read as a solid thing falling.
- Free objects can be picked up again (window-level raycast, only hits capture the pointer) and thrown. Released over the table, an object returns to the table layer and lands on it.
- The table layer canvas needs a margin around the table so objects are not clipped before the handoff.
- `put everything back` and `R` still work. Physics still loads on first grab. Two WebGL contexts are accepted; the second exists only while something is free. Dispose it when nothing is free. Touch rule unchanged: swipe scrolls, press-hold grabs.
- Poster regenerated with the perspective camera so 2D and 3D match again.

**Gap:** the empty space under the table (owner confirmed fix). Remove the reserved space: figure height comes from the canvas aspect, the hint sits directly under the table, the object list takes no space while the canvas is live, and `#desk` no longer has a viewport min-height. The about section follows closely on the normal section rhythm. CLS stays 0.

## G. Garden
Owner: "add new flower growing as well. and the user able to pick the flowers and add to bucket to make boquet. the dog design is still not natural. the head is abit like pig. fix that and make the ball more natural and i should be able to interact with the ball. pick the ball up and so".
- **Growing:** new flowers sprout and grow over time from the ground (stem rises, leaf unfolds, bud opens), especially where one was picked, up to a cap.
- **Picking:** press a flower to pick it; it comes away with its stem and follows the pointer; drop it in the bucket (or anywhere near: it flies in). A plain tap sends it straight to the bucket.
- **Bucket:** a line-art bucket stands in the garden; picked flowers stay in it, arranged as a growing bouquet (fanned stems, heads visible). A `start a new bouquet` control empties it. Count announced in a polite live region. Keyboard: a `pick a flower` button.
- **Dogs:** redraw so they read as dogs, in side profile: long tapered muzzle with a clear stop at the forehead, black nose at the very tip, a jaw line, soft drop ear set high and back, eye behind the stop, arched neck, deep chest, tucked belly, four jointed legs with paws, a tail with a curve. No round snout. Vary breed proportions. Run cycle with a real gait, head bob, mouth open with tongue when running. Check at 3x zoom in screenshots and keep fixing until the head is clearly a dog.
- **Ball:** a tennis ball look: curved seam lines that rotate as it rolls, squash on bounce, rolling friction, a soft shadow that follows height.
- **Ball interaction:** a ball rests on the grass. Press to pick it up, carry it, release with velocity to throw (flick speed matters). Dogs chase it, take it in the mouth and bring it back, and drop it near the pointer. Pressing the ball in a dog's mouth takes it back. Empty-ground clicks no longer throw a new ball. `throw a ball` button stays for the keyboard.
- Touch: `touch-action: pan-y`; press on a flower or ball grabs, swipes elsewhere scroll.
- New caption: `the garden. pick flowers for the bucket. throw the ball for the dogs.`

## C. Copy, CV, switch
- Facts list: `open to` becomes `mentorship, consulting, talks`. `role` becomes `Lead Engineer, Leapfrog Technology`.
- CV: Daboo Spaces, education and skills leave the roles table. Each gets its own paper card after the table: `co-founder` (Daboo Spaces, Kathmandu; a coworking space in Sankhamul Tower 1), `education` (BE computer engineering, Kantipur Engineering College, Tribhuvan University, 2021), `skills` (the list).
- Light mode switch: replace the `theme · paper` text with a real switch, `role="switch"`, labelled `light mode`, drawn to match the sheet (thin outline track, square-ish thumb, mono label, same radius as the panels), colours from the surface tokens so it matches both themes. Fixed at the top right inside the sheet border so it is always reachable while scrolling; no overlap with the title block at any width down to 320. Hidden without JS. Keeps the stored preference and OS default.
