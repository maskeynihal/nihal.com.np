# v3 improvements (owner request 2026-11-06)

Planned by the orchestrator (Opus). Built by Sonnet agents at low effort. Owner instruction: "You don't have to do rigorous testing. do testing only when all of the 9 works is completed." So during build each agent runs only `pnpm typecheck` and `pnpm build`, plus a quick look in a browser. Existing e2e tests may break; one test-and-fix agent repairs them at the end.

All earlier rules still hold: static Astro HTML for every readable word; React only for the desk canvas and the contact form; copy gate rules (no em dash, no `!`, no emoji, sentence case); commit trailer `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; never push.

## Owner answers (2026-11-06)
- Instagram: `https://www.instagram.com/maskeynihal`.
- Daboo Spaces: co-founder. Daboo Spaces is a coworking space on one floor of Sankhamul Tower 1, Kathmandu (https://daboospaces.com): hot desks, dedicated desks, private offices, meeting rooms, events, virtual office. No year is shown.
- Trayt: visible copy says "a US behavioural-health platform". Do not name Trayt in visible copy. The owner asked to keep the phrase "software engineer at Trayt" for search: it goes only into the `keywords` meta tag (see §1). Trayt is not in JSON-LD and not in visible text.

## Shared contracts (all workstreams)
- Theme: `document.documentElement.dataset.theme` is `blue` (default) or `paper`. Changing it dispatches `window` event `nihal:theme` with `detail.theme`. Canvas code (desk, garden) reads colours from CSS custom properties at runtime: `--page`, `--ink`, `--stroke`, `--panel`, `--panel-ink`, and repaints on `nihal:theme`. Never hard-code #1F3FE0 or white in canvas code.
- Motion: existing `data-motion` (`full`/`reduce`) gates every animation, as now.
- Events already in use: `nihal:drag`, `nihal:navigate`, `nihal:callout`, `nihal:desk-reset`.

## WS1 copy, SEO, CV, Daboo, Instagram (main checkout)
Files: `src/content/**` except `objects.ts`, `src/pages/index.astro` (sections only), section components, `src/layouts/Base.astro` head, `src/lib/jsonld.ts`, `docs/specs/02-copy.md` (sync the new copy in).

### 1. SEO
Ranking for these terms depends mostly on off-site signals (Search Console, backlinks from GitHub, LinkedIn, Hashnode, Daboo Spaces). On-page we do everything that helps and nothing that reads as keyword stuffing.
- `<title>`: `Nihal Maskey · Lead Software Engineer in Kathmandu, Nepal`
- Meta description (≤ 158 chars): `Nihal Maskey is a lead software engineer and team lead in Kathmandu, Nepal. He builds healthcare software on AWS at Leapfrog Technology and co-founded Daboo Spaces.`
- `keywords` meta (Google ignores it, other engines may not): Nihal Maskey, software engineer in Nepal, software engineer Kathmandu, best software engineers in Nepal, lead engineer Nepal, team lead Nepal, team lead Kathmandu, lead engineer at Leapfrog Technology, software engineer at Trayt, healthcare software engineer, health tech engineer Nepal, full stack developer Nepal, React developer Nepal, Node.js developer Kathmandu, TypeScript engineer, AWS engineer Nepal, Laravel developer Nepal, engineering manager Nepal, Daboo Spaces co-founder.
- JSON-LD `@graph`: `Person` (name, alternateName "Nihal Man Singh Maskey" only if already confirmed in content, jobTitle "Lead Software Engineer", description, url, image `/og.png`, email, address Kathmandu NP, worksFor Leapfrog Technology, alumniOf Kantipur Engineering College, knowsAbout [JavaScript, TypeScript, React, Node.js, Laravel, PHP, AWS, AWS Lambda, Amazon SQS, EventBridge, Step Functions, healthcare software, HIPAA, SOC 2, engineering leadership], sameAs [GitHub, LinkedIn, X, Instagram, Hashnode]); `Organization` Daboo Spaces (url, address Sankhamul, Kathmandu) with `founder` → the Person (Schema.org has no co-founder type; the visible text says co-founder); `WebSite`; `ProfilePage` with `mainEntity` → Person.
- New visible "about" section right after the desk (h2 "about"), plain natural prose that carries the search phrases honestly (copy in §2). Add it to the sheet index nav.
- Headings: h1 stays the name; add a visible kicker line under the h1: `lead software engineer · kathmandu, nepal`.
- Alt text, `lang="en"`, canonical, sitemap stay. Add `<meta name="author">`, `og:type profile`, `profile:first_name`, `profile:last_name`.

### 2. Copy deck (use as written; small edits only for fit)
Voice: first person, plain, specific, a little dry. No "passionate", no "innovative", no "solutions", no superlatives about himself.

Title block
- kicker: `lead software engineer · kathmandu, nepal`
- intro: `I lead an engineering team at Leapfrog Technology that builds a US behavioural-health platform on AWS. I co-founded Daboo Spaces, a coworking space in Sankhamul. The rest of this sheet is things I built because I wanted them.`
- actions: email link (existing CopyEmail) and a second link `see the projects →` to `#projects` (arrow in mono).
- drag hint: `pick something up. throw it off the table if you like.`
- reset: `put everything back`

About (new section)
- heading `about`
- p1: `I'm a software engineer in Kathmandu, Nepal. I've been building for the web since 2019, the last six at Leapfrog Technology, where I went from intern to lead engineer.`
- p2: `Today I lead the team behind a US behavioural-health platform. The work is mostly TypeScript, React, Node.js and AWS: queues, Lambdas and Step Functions, with patient data that has to meet HIPAA and SOC 2. I care about fast pages, boring deploys and code the next person can read.`
- p3: `I work with people in the US, Australia and Nepal, so a lot of my job is writing things down clearly and running reviews that teach something.`
- p4: `Outside work I co-founded Daboo Spaces, a coworking space in Sankhamul, Kathmandu, with desks, private offices and a community of founders, freelancers and remote workers.` Link "Daboo Spaces" to https://daboospaces.com.
- small facts list (dl, mono labels): `based in` Kathmandu, Nepal · `role` lead engineer, Leapfrog Technology · `co-founder` Daboo Spaces · `stack` TypeScript, React, Node.js, Laravel, AWS · `open to` engineering leadership roles, consulting, talks (owner can edit).

Section intros
- work: `Side projects, each built to fix something that annoyed me.`
- open source: keep current.
- writing: keep current.
- cv: `Since 2019: two companies, and a long climb at Leapfrog from intern to lead.` plus the existing Leapfrog note.
- contact lead: `Email is fastest. I read everything and reply to most within a couple of days.`
- colophon: keep, add `Built with Astro and three.js. The desk is code, not a model file from a store.`

CV (extend; table stays, each role gets a short bullet list in a `<details>` or a second cell; no-js readable)
- lead engineer, Leapfrog Technology, 2025 → now: lead the engineering team for a US behavioural-health platform; own the AWS architecture for sensitive health data under HIPAA and SOC 2; mentor engineers and set code review and security practice; work with product and design on what ships next.
- senior software engineer, Leapfrog Technology, 2023 → 2025: coordinated work across teams in the US, Australia and Nepal; cut the frontend bundle by 20% with tree-shaking and memoisation; made key backend APIs more than twice as fast; automated backups, metrics and notifications with SQS, EventBridge, Lambda and Step Functions; shaped the technical roadmap and wrote user stories.
- software engineer, Leapfrog Technology, 2021 → 2023: led a team of more than 15 across development, design, DevOps and QA; planned releases with product owners and shipped major versions; main contact for stakeholders and management.
- associate software engineer, Leapfrog Technology, 2020 → 2021: built features with senior engineers and product owners; tracked down root causes in production bugs; built a browser extension the team used daily.
- software engineer intern, Leapfrog Technology, 2020: learned JavaScript and the canvas API by rebuilding Pac-Man with path-finding ghosts; first steps in Node.js and React.
- web application developer, Technorio, 2019 → 2020: shipped web apps for insurance management, video streaming and ticketing; set up GitHub Actions deploys; worked with business development on estimates.
- co-founder, Daboo Spaces, Kathmandu: coworking space in Sankhamul Tower 1 (no dates).
- BE computer engineering, Kantipur Engineering College, Tribhuvan University, 2021.
- skills row: TypeScript, JavaScript, React, Node.js, Laravel, PHP, AWS (Lambda, SQS, EventBridge, Step Functions), PostgreSQL, MySQL, HIPAA and SOC 2 work, team leadership.

Socials: github, linkedin, x, instagram (`https://www.instagram.com/maskeynihal`), hashnode.

## WS2 the desk: lower table, more objects, fall to the screen (worktree `../nihal-desk`)
Files: `scripts/models/**`, `src/assets/**`, `src/content/objects.ts`, `src/components/desk/**`, `src/lib/desk/**`, `src/styles/desk.css`, `src/components/Poster.astro`, `ObjectList.astro`.

Look: same white line art on the page colour (theme-aware via CSS vars).

1. Table lower: the table sits lower in the hero (below the title block line on desktop; on phones under the title block), with room around it.
2. New objects, code-built like the others, line-art: an open MacBook-style laptop (generic, no logo), 3 balls (different sizes), 2 Pac-Man figures (the wedge shape, one ghost already exists), the letters N I H A L as chunky extruded letters. Keep total tris ≤ 8k, bodies ≤ 16.
3. Falling to the screen: the canvas becomes a fixed full-viewport transparent layer (`position: fixed; inset: 0; pointer-events: none; alpha: true`), above page content. The table is drawn where the `#desk` figure is on the page and moves with scroll (read its DOM rect each frame while visible). Use an orthographic camera with a fixed tilt so the screen-to-world mapping is linear; lock body translation on depth so physics is effectively 2D in screen space while models still rotate in 3D.
   - Each object is either on the table (rides with the table, no physics cost) or free.
   - Grab (pointer handled on `window`, raycast against objects; only a hit starts a drag and captures the pointer, everything else passes through to the page) and drag/throw as now. Drop it off the table edge and it falls with gravity.
   - The world boundary is the screen: floor collider on the viewport bottom, walls on the sides, a ceiling at the top. Free objects stay on screen while the page scrolls and keep falling and bouncing; a scroll gives free objects a small jolt opposite the scroll direction so the pile feels alive.
   - The table is a kinematic collider while visible, so objects can land back on it.
   - On phones: objects scale down; fallen objects collect at the bottom of the screen; a small `put everything back` button appears whenever any object is free (fixed, bottom corner), and the `R` key does the same.
   - Physics still loads only on first grab. Before that, no physics cost.
   - Remove the exploded view (E-07); it conflicts with free objects. Keep callouts on grab and tap-to-navigate.
   - Frameloop demand: render only while something moves, while scrolling with the table visible, or on resize.
   - Poster fallback (no WebGL, reduced motion, low-end) stays: regenerate `poster.svg` with the new objects and the lower table.

## WS3 the garden at the end of the page (worktree `../nihal-garden`)
Files: new `src/components/garden/**`, `src/lib/garden/**`, `src/styles/garden.css`, and one mount line in `src/pages/index.astro` just above the colophon (merge note: this one line will conflict, keep both).

A wide strip (desktop ~420 px tall, phone ~320 px) drawn in the same line-art style, theme-aware: grass, flowers, two dogs, balls, wind, butterflies.
- Tech: vanilla TypeScript on a 2D `<canvas>` (no React, no three), started by IntersectionObserver, paused off-screen and on hidden tab, DPR-capped at 2. Under reduced motion: one still frame, no loop.
- Grass blades and flower stems sway with a wind field (smooth noise). Moving the pointer across the garden makes a gust that bends the grass in that direction.
- Flowers: a few kinds (daisy, tulip, simple five-petal), drawn in line art; they bob in the wind.
- Butterflies (3 to 5) flutter on wandering paths, land on flowers for a moment, and scatter away from the pointer.
- Dogs (2): simple line-art dogs that idle, wag, trot. Click or tap anywhere in the garden to throw a ball there; the nearest dog runs to it, picks it up and brings it back to where the pointer is. Balls bounce and roll.
- Keyboard: a visible button `throw a ball` throws to a random spot. The canvas is `aria-hidden`; the section has a short visible caption: `the garden. click to throw a ball for the dogs.` and an h2 is not needed (it is decoration), but the wrapper is a `<section aria-label="garden">`.
- Size: under 12 KB brotli for the garden script. Loaded as a separate chunk when near the viewport.

## WS4 light theme and hover (main checkout, after WS1)
Files: `src/styles/**` except desk.css and garden.css, `src/lib/prefs*.ts`, `src/lib/prefs-inline.js`, `src/components/*Toggle.astro`, `TitleBlock.astro` (toggle placement), `src/components/WorkPanel.astro`, etc.
- Light theme from lahin-kit "paper" mode (`../lahin-kit/ui/src/app.css`): page `#F6F5F1`, page-deep `#ECEBE5`, ink `#0A1C6B`, ink-soft rgb(10 28 107 / 0.7), stroke `#1F3FE0`, hair rgb(31 63 224 / 0.1), hair-strong rgb(31 63 224 / 0.3), panel `#FFFFFF`, panel ink `#0A1C6B`. Blue mode stays as it is.
- Restructure tokens as lahin-kit does: surface tokens (`--page`, `--page-deep`, `--ink`, `--ink-soft`, `--stroke`, `--hair`, `--hair-strong`, `--panel`, `--panel-ink`, `--panel-ink-soft`, `--panel-hair`, `--panel-accent`) swapped by `:root[data-theme="paper"]`. Every component uses them.
- Theme toggle in the title block next to motion and sound: `theme · blue` / `theme · paper`. Stored in localStorage; default follows `prefers-color-scheme` (light → paper, dark → blue) until the visitor chooses. Set pre-paint in `prefs-inline.js` (no flash). `theme-color` meta updates. Dispatch `nihal:theme`.
- Poster SVG and work marks use `currentColor` / `--stroke` so they follow the theme.
- Hover, all motion-gated, all with a matching `:focus-visible` state:
  - text links: underline draws in from the left (background-size on a 1 px gradient), 180 ms;
  - nav rows: a short leader line slides out and the label shifts 4 px;
  - work panels: lift 4 px with a crisp offset outline in `--stroke` (no blur shadow), the mark redraws its stroke once (stroke-dashoffset), the title gets the underline;
  - table rows: keep the C-02 leader, add a faint row tint;
  - buttons: invert colours (ink background, page text) with a 120 ms transition; pressed state nudges 1 px;
  - socials: the arrow `→` moves 3 px right.
  - pointer: fine only for lifts (`@media (hover: hover) and (pointer: fine)`).

## Final: merge, test, fix (one agent, after WS1 to WS4)
Merge `rebuild/desk` and `rebuild/garden` into `rebuild/blueprint`, resolve conflicts, then `pnpm verify`, `pnpm review:all`, `pnpm lhci` (SEO 100 on `/`), fix what broke, update or retire tests made obsolete by the new behaviour (E-07 removed; desk canvas now fixed full-screen), add light-theme axe runs. Screenshots of both themes at desktop and phone for the owner.
