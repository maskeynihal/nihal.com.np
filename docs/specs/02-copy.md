# 02. Copy spec v2

Status: v2 for owner approval. Date 2026-11-05. v1 critiqued in `reviews/plan-critique-03-copy.md`; every invented specific removed. Facts only from `docs/profile/nihal-maskey.md`. [CONFIRM] = owner must say yes. [ASK] = owner must supply the fact or the line is cut. US spelling ("resume"). Sentence case. First person.

## 1. Voice rules
1. Say what was done, with a noun and a number that has a source.
2. One idea per sentence. Vary length and shape; no two panels share a skeleton.
3. No adjective that cannot be replaced by a fact.
4. No paragraph ends on a punchline. No "Not X. Y." fragments.
5. City once, as a fact. Timezone as a utility.
6. No em dashes. No exclamation marks. No emoji or ♥.
7. Headings lowercase, 1-2 words. Body copy normal case.
8. Never hard-code a count or a year span: "since 2019", or a value from the build-time data.
9. One live clock above the fold (the title block). Three in contact. Nowhere else.

## 2. Banned list (build gate)
Scope: **prose only**. All user-facing strings (copy, microcopy, alt text, aria-labels, console text) live in `src/content/**`; `scripts/copy-gate.ts` greps that tree only, case-insensitive, word boundaries, exits 1 with `file:line: word`. Code, tests and comments are not gated.

Words: passionate, seamless, seamlessly, leverage, leveraging, elevate, unlock, delve, robust, cutting-edge, innovative, impactful, journey, crafting, crafted, empower, synergy, dynamic, results-driven, proven track record, best practices, exceptional, state-of-the-art, harness, foster, facilitate, utilize, showcase, streamline, scalable solution, game-changing, transformative, revolutionize, pivotal, realm, landscape, tapestry, testament, meticulous, meticulously, vibrant, multifaceted, nuanced, intricate, comprehensive, holistic, bespoke, world-class, thought leader, ninja, guru, rockstar, wizard, enthusiast, tech-savvy, detail-oriented, self-starter, team player, visionary, curated, immersive, delightful, magical, supercharge, unleash, frictionless, next-level, paradigm, additionally.

Phrases: digital experiences, user experiences, based in, let's connect, let's build, turning ideas into reality, bringing ideas to life, bring ideas to life, at the intersection of, end-to-end, from concept to, welcome to my, here's the thing, it's worth noting, in today's, fast-paced, let's dive, stay tuned, feel free to, don't hesitate, reach out, coming soon, pixel-perfect, build something amazing, lorem ipsum, in conclusion, in summary, whether you're, stands as, serves as, made with.

Allowlist (exact, case-sensitive): `DynamoDB`, `Loop Harness`.

Reviewer-only (not grep): "craft"/"underscore" as verbs; rule-of-three where three is not the count; zinger endings; parallel openers or identical panel skeletons; rhetorical-question headings; colon-reveal titles; Title Case; casualisms stacked into a costume ("eating your disk", "tried to kill me", "the hard bit"); humblebrag detail.

## 3. Draft copy (v2)

### Sheet index (nav)
Rows: desk · about · work · open source · writing · cv · contact · colophon
Toggles: "reduce motion" (`aria-pressed`) · "sound" (`aria-pressed`, state text "on" / "off") · note when the OS forces reduced motion: "set by your system"

### #desk: title block
h1: **nihal maskey**
Line (one sentence, choose one; A is default):
- A. "I'm a software engineer in Kathmandu. I lead a team at Leapfrog Technology that builds healthcare software on AWS, and I make tools I needed and could not find."
- B. "Lead engineer at Leapfrog Technology, a software services company in Kathmandu. Since 2023 I've worked on one US behavioral-health platform, mostly on the AWS side. Everything else on this sheet is a side project."
- C. "Software engineer, Kathmandu. Days: a healthcare platform on AWS for Leapfrog Technology. Evenings: the things on this sheet."
Mono rows: `contact@nihal.com.np` (copy) · `14:32 kathmandu · utc+5:45` (live) · `rev 2026.11 · sheet 1 of 1 · scale 1:1` (rev from build date)
Under the drawing (mono): "drag things around. tap one to jump to its section." · button "reset the desk"
Skip link: "skip the 3D desk"
Poster description (`role=img`): "Line drawing of an Arduino board with a small OLED screen, three desk clocks, a Nepali desk calendar and a Pac-Man ghost laid out on blueprint paper." (+ ", and a toy Land Cruiser" if confirmed)
Object list labels (mono links): "arduino water monitor → car sensors" · "clocks → contact" · "calendar → open source" · "pac-man ghost → pac-man" · ("land cruiser → car sensors")
Callout notes (`objects.ts`, two words each): arduino "uno r4" · clocks "ktm / [city] / [city]" · calendar "bikram sambat" · ghost "canvas, 2020" · cruiser "hj60" [CONFIRM]
OLED caption (DOM, mono): "demo values"

### #work
Heading: **work**

**trayt health** · mono date line: "jan 2025 → · lead engineer" · Leapfrog Technology, for Trayt Health [CONFIRM name may appear]
"A behavioral-health platform for psychiatry access programs and managed care organizations. I joined the project as a senior engineer in 2023 and have led the engineering team since January 2025. My own code is mostly on AWS: SQS, EventBridge, Lambda and Step Functions for backups, metrics and notifications, plus the HIPAA and SOC 2 work that comes with health data. [ASK: one sentence on what was actually hard, in your words.] [CONFIRM numbers before adding: 20% smaller frontend bundle, API response times over 200% faster, and how each was measured.] The team sits in Nepal, Australia and the US."
Frame: an empty drawing frame with the title block filled in. Line: "Client work, so there is no code to link. Ask me about it."

**tz converter** · "nov 2026 · 0.8.1 in the chrome web store and firefox add-ons" · Chrome, Edge, Brave, Firefox
"A browser extension, TypeScript, Manifest V3. Select a time on a page and a popover shows it in the zones you've chosen. It also has a full converter, an epoch converter, right-click convert, custom date formats, and a world clock at tz.nihal.com.np/clock. I built it because the people I work with are in Nepal, Australia and the US. [ASK: hardest part, one sentence.]"
Links: Chrome Web Store · Firefox Add-ons · tz.nihal.com.np · GitHub

**space hog** · "oct 2026 · rust, egui" · macOS, Linux
"A desktop app that shows what is using your disk: largest files, drill-down by folder, breakdown by file type, cache cleanup suggestions, and a CLI mode. Universal build for macOS, and Linux. [ASK: hardest part; largest volume you tested.]"
Links: GitHub

**car sensors** · "oct 2026 · arduino uno r4 wifi, esp32-s3"
"Firmware for two Land Cruisers. [CONFIRM] For the LC78, a UNO R4 reads water temperature from a DS18B20 and air temperature and humidity from a DHT22, shows them on a small OLED, and sounds a buzzer on alarm. For the HJ60, an ESP32-S3 reads the factory coolant sender and draws the temperature on a TFT. The repo is set up so a coding agent can build and run the firmware in a Wokwi emulator on a Mac before anything is flashed to the car. The buzzer jammed because tone() and digitalWrite() were driving the same pin, which took a while to find."
Links: GitHub · the write-up on Hashnode

**pac-man** · "aug 2020 · javascript, canvas"
"My internship project at Leapfrog, written to learn JavaScript and the canvas API. Easy, medium and hard modes, three power-ups (Red Cherry, Ghost Wrap, Blue Dot), and a two-player mode on WASD with a freeze and unfreeze mechanic. [ASK: who gets frozen.] The ghosts use path-finding rather than random movement. [ASK: which algorithm.] You can play it here."
Arcade panel: button "play" · after load "esc to leave" · link "open the game in a new tab"
Links: GitHub · play standalone

### #open-source
Heading: **open source**
Intro: "Pull requests merged into other people's repositories. Counts come from the GitHub API at build time."
Revision table columns: repo · what · merged
Rows: digitalocean/nginxconfig.io · independent scrolling in split-column mode · 2023-06 / digitalocean/nginxconfig.io · prettier via lint-staged · 2023-10 / spatie/holidays · Nepal holiday calendar, with tests · 2024-10 / kritish-dhaubanjar/dynamodb-dashboard · 18 commits: validation, download, search fixes, demo videos · 2023 → 2026 / kritish-dhaubanjar/dev-auth-chrome-extension · Svelte rewrite, add-user form, token handling · 2021 → 2022 / benawad/dogehouse · Nepali translation, persist language · 2021 / supabase/supabase · null-check fix; docs · 2021 → 2023
Footer line: "{merged} merged, {closed} closed without merging, as of {build date}."

### #writing
Heading: **writing**
Intro: "Posts on Hashnode since 2022. Four are server and Laravel notes; the latest is the Arduino monitor."
List: date · title · one line (from profile). Then "all posts on hashnode".

### #cv
Heading: **cv**
| 2025 → | lead engineer | Leapfrog Technology, for Trayt Health [CONFIRM] |
| 2023 → 2025 | senior software engineer | Leapfrog Technology, for Trayt Health [CONFIRM] |
| 2021 → 2023 | software engineer | Leapfrog Technology |
| 2020 → 2021 | associate software engineer | Leapfrog Technology |
| 2020 | intern | Leapfrog Technology |
| 2019 → 2020 | web application developer | Technorio, Kathmandu |
| 2021 | BE computer engineering | Kantipur Engineering College, Tribhuvan University |
Line: "Leapfrog Technology is a software services company in Kathmandu." · "resume (pdf)" only if a live PDF exists [Q5].

### #contact
Heading: **contact**
Lead: "Email works best. I reply within a day or two. [CONFIRM]"
Email button: "contact@nihal.com.np" → "copied"
Clocks: Kathmandu · [city 2] · [city 3] [ASK]. Sentence: "Kathmandu is UTC+5:45 with no daylight saving. My mornings are Australia's afternoon and the US West Coast's evening. [CONFIRM regions]"
Form: "your name" · "your email" · "what's this about" · "message" · button "send"
Success (JS and `/sent` page): "Sent. I'll reply from contact@nihal.com.np."
Errors: "That email doesn't look right." · "Add a sentence or two." · "Didn't send. Email me directly: contact@nihal.com.np"
Links: github · linkedin · x

### #colophon
"© 2026 Nihal Maskey. Analytics: Vercel only, no cookies. [CONFIRM] Source on GitHub."
No font list. No "made with". Optional Nepali end mark per design §12.3.

### 404
Heading: **nothing here** (inside an empty title block, mono "sheet not found")
"That page moved or never existed."
Link: "back to the desk"

### /sent
Heading: **sent**
"I'll reply from contact@nihal.com.np." · link "back to the desk"

### Loading / unavailable (mono)
Physics loading: "loading 3D" · 3D off: "3D is off on this device. Everything still works." · Context lost: "3D paused. Reload if it doesn't come back."

### Console
"hi. source: github.com/maskeynihal/nihal.com.np. press R with the desk focused to reset it."

## 4. Review checklist
- [ ] Every number traces to a profile line or build-time data.
- [ ] No [CONFIRM] or [ASK] remains at ship; cut lines whose answer never came.
- [ ] `copy-gate` passes on `src/content/**`.
- [ ] Reviewer reads every panel aloud; no two panels share a skeleton; zero zinger endings.
- [ ] Zero exclamation marks.

## 4. v3 copy (2026-11-06, supersedes the matching lines above)
Source of truth is `src/content/copy.ts` and `cv.ts`; deck in `docs/specs/04-v3-improvements.md` section 2.
- Index rows: desk · about · work · open source · writing · cv · contact · colophon.
- Title: "Nihal Maskey · Lead Software Engineer in Kathmandu, Nepal". Description (146 chars): "Nihal Maskey is a lead software engineer in Kathmandu, Nepal. He builds healthcare software on AWS at Leapfrog Technology and co-founded Daboo Spaces." Keywords meta on the index only; it names Trayt, visible text does not.
- Title block: kicker "lead software engineer · kathmandu, nepal"; intro (option A) "I lead an engineering team at Leapfrog Technology that builds a US behavioural-health platform on AWS. I co-founded Daboo Spaces, a coworking space in Sankhamul. The rest of this sheet is things I built because I wanted them."; second action "see the work →" to #work; drag hint "pick something up. throw it off the table if you like."; reset "put everything back".
- #about: three paragraphs, a fourth linking Daboo Spaces (https://daboospaces.com), and a facts list (location, role "Lead Engineer, Leapfrog Technology" (capitalised at the owner's request), co-founder, stack, open to "mentorship, consulting, talks"). The label "location" replaces the deck's "based in", which is a banned phrase.
- #work intro: "Side projects, each built to fix something that annoyed me."
- #cv: intro "Since 2019: two companies, and a long climb at Leapfrog from intern to lead.", bullets under each role, then three paper cards after the roles table: co-founder (Daboo Spaces, Kathmandu; a coworking space in Sankhamul Tower 1), education (BE computer engineering, Kantipur Engineering College, Tribhuvan University, 2021) and skills.
- Light mode switch: `role="switch"`, label "light mode", fixed top right inside the sheet border, hidden without JS.
- #contact lead: "Email is fastest. I read everything and reply to most within a couple of days." Socials add instagram and hashnode.
- #colophon adds: "Built with Astro and three.js. The desk is code, not a model file from a store."
