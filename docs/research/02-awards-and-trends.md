# Research 02: Award-winning sites, interactive portfolios, trends (2016-2026)

Research date 2026-11-05. "[unverified]" = no primary source reachable (thefwa.com blocks fetches; awwwards annual pages partly 404).

## 1. Winners

### Awwwards Site of the Year / Developer Site of the Year
| Year | SOTY | DEV | Concept |
|---|---|---|---|
| 2016 | Falter Inferno (WILD) | Paper Planes (Active Theory) | Scroll-driven WebGL Dante. Fold a paper plane on phone, throw into shared world. |
| 2017 | OUIGO Let's play (Merci-Michel) | The New Mobile Workforce (Immersive Garden) | Illustrated mini-game site. WebGL office. |
| 2018 | Active Theory v4 | Koox (Blue Cheese) | Agency portfolio as real-time WebGL environment. |
| 2019 | Nomadic Tribe (Makemepulse) | **Bruno Simon Portfolio** (also Users' Choice) | Drive a physics car (Three.js + Cannon, Draco GLTF < 2 MB); signposts are nav; easter eggs. |
| 2020 | Pioneer Corn Revolutionized (Resn) | Kode Sports Club (Merci-Michel) | Stylised 3D narrative. "Solid and playful". |
| 2021 | Prometheus Fuels (Active Theory) | Umami Land (Monks) | Interactive story; art direction. |
| 2022 | KPR (Resn) | Persepolis Reimagined (Monks) | Minimal futurism; WebGL walk-through. |
| 2023 | **Lusion v3** | Lusion v3 | Studio folio; real-time WebGL + physics bound to scroll; cursor-reactive. Swept Awwwards, FWA, CSSDA. |
| 2024 | Igloo Inc (abeto) | Igloo Inc | Fluid-sim WebGL **with ordinary scroll navigation**. "Video game turned website." |
| 2025 | Lando Norris (OFF+BRAND) | Messenger (abeto) | Three.js helmet, cursor blobs. Messenger: delivery game on tiny planet, DEV 8.21, Accessibility weakest axis on Norris (7.00). |
| 2026 | announced Feb 2027 | | |

Independent of the Year: Bryan James 16, Aristide Benoist 17/19, Martin Silvestre 18, Zhenya Rynzhuk 20, Luis Henrique Bizarro 21, Jesper Landberg 22/24, Louis Paquet 25.

### FWA of the Year
2016 Through the Dark; 2020 Medal of Honor; 2021 Prometheus Fuels; 2022 Persepolis; 2023 Lusion v3; others [unverified]. Three of last five FWA winners were also Awwwards winners: juries converge on real-time 3D storytelling.

### CSS Design Awards WOTY
2016 Because Recollection; 2017 Welcome to Hogwarts; 2018 Nike Reactor; **2019 Bruno Simon ("first solo portfolio to score highest in WOTY history")**; 2020 Medal of Honor; 2021 E.C.H.O.; 2022 Coastal World; 2023 Lusion v3; 2024 Buttermax; 2025 Dropbox Brand.

### Portfolios worth studying
- **Bruno Simon 2019**: car is the cursor; bump objects; signposts are nav; <2 MB. Triggered a wave of drive-around clones (now a cliché to copy literally).
- **Henry Heffernan 2022**: Three.js desk with CRT, screen is an iframe OS (draggable windows, Doom, résumé inside). HN criticisms: no Firefox, mobile crashes, "a way to view the site without the simulation" requested.
- **Lusion v3 2023**: only triple-crown site. Physics + scroll + cursor materials, restrained palette.
- **Jesper Landberg**: twice Independent of the Year for consistency and range across client work; own folio only 7.62. Lesson: restraint + motion craft > spectacle.
- **Yannis Yannakopoulos v2**: three modes: WebGL, Experimental, Accessibility (no WebGL); auto-switch on `prefers-reduced-motion`; no-WebGL build doubles as mobile build. Best documented "plain mode".
- **Robb Owen**: content-first, "Skip to content", "Hire me" = prefilled mailto, contact repeated in menu and footer.
- Grégory Lalle 2024 case study: dropped WebGL images on mobile, kept all projects reachable from home.

## 2. What judges reward and punish
Awwwards weighting: Design 40 / Usability 30 / Creativity 20 / Content 10. Developer award separate rubric: Semantics/SEO, Animations, Accessibility, WPO, Responsive, Markup; needs > 7.

Rewarded: one signature idea and everything protects it; motion choreography (timing, easing, sequencing; transform/opacity only); typographic confidence; scroll as narrative while native scrolling stays; sound as choreography; perf (LCP < 2 s, CLS < 0.05, INP < 100 ms, < 3 MB, 60 fps, DPR cap 2, WebGL mounted on intersection and paused offscreen); cross-device parity (jurors browse on phones; broken phone caps at Honorable Mention); real content.

Punished: scrolljacking (NN/g: disorienting; never change direction/speed; keep key text out of hijacked zones; breaks Cmd+F); long preloaders ("6 s loader is a usability penalty"); no mobile parity; accessibility ignored (keyboard, focus, reduced motion, text in canvas); recognisable templates; trend-stacking; "if everything moves, nothing stands out".

## 3. Portfolio lessons
- Make the gimmick the navigation so play and wayfinding are one act. Always give an escape hatch; never gate content behind interaction. One codepath for fallback, three triggers: reduced motion, no WebGL, small/low-power device.
- Winners rarely use a vertical timeline widget; they use 3-5 deep case studies plus a short credentials line. Résumé reachable directly.
- Contact prominent, repeated, low friction. Never hidden in an easter egg.
- Keep real DOM text for SEO and the Semantics score.
- Performance budget as a design constraint from day one.

## 4. 2025-2026 trend verdicts
- Bento grids: tired baseline. Glassmorphism: overdone. Dark mode + purple/indigo glow: overdone, AI tell. 3D blobs: tired. Kinetic split type: overdone unless one moment. Neumorphism, Y2K without reason, experimental nav for its own sake, generic AI imagery: tired.
- Grainy/tactile texture as "human-made" counter: fresh for now. Brutalist anti-grid type: fresh but risky (contrast, reading order). Scrollytelling: fresh when functional. 3D/WebGL product viewers: still what wins, usually underdelivered. Restraint, content-first, performance-first: fresh.

## 5. AI slop checklist (visual)
- Type: Inter/Plus Jakarta/Geist/Roboto as display; default Tailwind scale; single font for everything; flat hierarchy; italic serif word dropped into sans headline.
- Color: purple-blue / violet-indigo gradients (Tailwind indigo-500 demo default); gradient text; pink-purple CTA; radial halo behind hero; dark mode with glowing accents; dark mode as inverted light.
- Layout: centered hero + gradient headline + two buttons (primary gradient, secondary ghost); pill badge above H1; "label above a heading"; arrow chevrons on every CTA; round-number stat row (47%, 3x, 10,000+); three identical icon cards (Lucide in coloured circle); rounded-2xl everywhere; shadow + border + tint stacked; nested cards; gradient borders; identical section padding; everything centered; bento with no hierarchy.
- Decoration: glass everywhere; drifting blobs / particles / stock 3D abstract shapes; decorative grid-line background; pulsing status dot; blinking cursor; auto-scrolling logo marquee; bounce/elastic easing; same hover on everything; shimmer buttons; motion with no state meaning.
- Content: emoji as icons or in headings; placeholder SVG illustrations; stock hero photos; fake proof (Jane Doe CEO of Acme, 5-star rows, "Trusted by 10,000+ teams").
- States: no empty/loading/error/disabled; `outline: none`; hover-only actions; lorem ipsum.
- Why: models regress to tutorial-mean. Fix: explicit constraints (chosen face, palette from the brand, layout principle, tone) and a named list of defaults to avoid.

Writing tells: see `04-copy-voice.md` section 3 (merged gate list in `specs/02-copy.md`). Additional: "stands as / serves as", sentence-initial "Additionally", "Whether you're a ... or a ...", "In conclusion", "-ing" tail clauses ("...ensuring a seamless experience"), significance inflation ("a testament to"), vague attribution ("experts argue"), bold run-in headers, markdown leftovers in rendered copy.

## Sources
awwwards.com/about-evaluation; awwwards.com/annual-awards-2019..2024; awwwards.com/annual-awards/winners; awwwards-2020.tubikstudio.com/hall-of-fame; awwwards.com/sites/lusion-v3; awwwards.com/sites/lando-norris; awwwards.com/sites/messenger; awwwards.com/igloo-inc-case-study.html; awwwards.com/portfolio-of-yannis-yannakopoulos-v2.html; awwwards.com/case-study-gregory-lalle-portfolio-2024...; cssdesignawards.com/woty-award-winners and yearly blog posts; thefwa.com/live-judging; news.ycombinator.com/item?id=31313187; github.com/henryjeff/portfolio-website; nngroup.com/articles/scrolljacking-101; conference.awwwards.com/valencia-developers/speakers/cyd-stumpel; utsubo.com/blog/award-winning-website-design-guide; hontran.dev/blog/awwwards-judging-criteria; studiomeyer.io/en/blog/webdesign-trends-2026-reality-check; bubble.io/blog/web-design-trends; 925studios.co/blog/ai-slop-design-tells; prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website; impeccable.style/slop; en.wikipedia.org/wiki/Wikipedia:Signs_of_AI_writing
