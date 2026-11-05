# Plan critique 03: copy and facts, 2026-11-05

Reviewer: independent critic subagent. Target: `specs/02-copy.md` v1 §3 vs `profile/nihal-maskey.md`. Summary: draft broke its own "facts only" rule ~15 times with invented specifics; five identical panel shapes with a "Hard bit:" tail; six sections end on a zinger.

## Blockers (false or unsupported)
B1 "about 3x faster" + "slowest endpoints": résumé says "over 200% faster", method unknown. Drop or quote with caveat until owner gives method.
B2 "used by psychiatry access programs in the US": profile has "for Psychiatry Access Programs and MCOs". "Used by" asserts customers; "US" inferred.
B3 "No release manager", Sydney, San Francisco: none in profile (profile: US, Australia, Nepal). Overlap sentence also wrong: Kathmandu 09:00 = Sydney 13:15-14:15 (afternoon), California previous evening.
B4 "'3pm PT tmrw' is valid input": no evidence extension parses relative dates.
B5 "2 TB drive ... also compiling": zero support; humblebrag. "CLI mode for servers": profile says "CLI mode".
B6 "A* search", "four ghosts", "freeze the first player": profile says "path-finding algorithms", "freeze/unfreeze co-op". Ask.
B7 "an old Land Cruiser" singular: repo has LC78 (UNO R4 water+air) and HJ60 (ESP32 coolant). Two trucks; boards mixed up; "cabin" unsupported.
B8 "41 merged ... 18 that were not": intro says API at build time, footer hard-codes. Pick one. "Those taught me more": zinger.
B9 "A buzzer and a sensor shared a pin": profile says `tone()` and `digitalWrite()` shared a pin.
B10 "終点 · END": no Japan link; forced quirk. Cut.

## Major
M1 Hero "My team builds the backend": team is not "the backend"; "that week"/"small tools" = Dan Eden trope.
M2 "clinicians use to track patients": invented product description.
M3 "Step Functions for backups and reports, EventBridge for scheduled stuff": résumé says SQS/EventBridge/Lambda/Step Functions for backups, metrics, notifications. Quote the nouns.
M4 "converts any time you select": "any" overclaims.
M5 "builds products for US clients": generalised from one client. Say "software services company in Kathmandu".
M6 "answer most within a day or two": owner promise, needs [CONFIRM].
M7 "I write when something took more than a day": aphorism. Describe what is there (5 posts, 4 server/Laravel, latest Arduino).
M8 "Hard bit:" formula x5, one sourced. Delete the label; fold the sourced one into prose; ask owner for the others.
M9 Six zinger closings. Buzzer line may appear once (it is his blog title), not in two places.
M10 Rule-of-three where three is not the count: "HIPAA, SOC 2, AWS"; three of five TZ features; "Kathmandu, Sydney, US"; "made with ♥..."; "the desk is real. pick things up. tap one...".
M11 Job-ad register in #now Trayt slip.
M12 Two clocks above the fold plus three in contact. Keep rail time and contact clocks only.

## Minor
"real path-finding" (adjective); "both stores" vs four browsers; casualism as costume ("eating your disk", "kill me", "the hard bit", "pick things up"); #now dates must be event dates; 404 says desk twice; console egg "on the desk" unclear; alt text lists props not in profile (if invented, say "illustration"); US spelling vs "résumé" and "the hard bit"; "open source" two words in rail is fine.

## Slop pass
Grep hits on banned list: none. Em dashes: none. Exclamations: none. Title Case: "END". Emoji: "♥". Structural hits as above.

## Headings
"path" → **cv**. "end" → drop from rail or **colophon**. Rail: desk · now · work · open source · writing · cv · contact (· colophon). (Design critic separately says delete `now`; orchestrator decision: delete `now`, dated lines on work panels.)

## Microcopy
"insert coin" → "play" (first arcade joke anyone makes). "loading weight" → "loading 3D". "the desk is real. pick things up. tap one to go somewhere." → "drag things around. tap one to jump to its section." "3D paused." → "3D paused. Reload if it doesn't come back." "skip the desk" → "skip the 3D desk". Sound toggle: label "sound" + state text. Keep: "reset the desk", "copied", form copy, "nothing here", "3D is off on this device. Everything still works."

## Banned-list false positives (gate greps code too)
`landscape` (media query), `dynamic` (imports), `unlock` (`unlockAudio` on iOS), `harness` ("Loop Harness", "test harness"), `end-to-end`/`journey` (Playwright names), `underscore`/`craft` (grep cannot see part of speech), `robust`/`additionally`/`serves as` in comments, `wizard` components.
Fix: **scope the gate to prose**: all user-facing strings live in `src/content/**` (incl. microcopy, alt, aria-labels, console egg); gate only that tree. Allowlist exact tokens: `DynamoDB`, `Loop Harness`. Drop "underscore (verb)" and "craft (verb)" from grep; reviewer catches them.

## Added questions for Nihal (9-27)
Teammate cities for clocks; Trayt disclosure scope and team size; method behind 200% and 20%; what was hard on Trayt; TZ hardest part, parses relative input?, which stores; Space Hog hardest part, largest volume, is cache cleanup shipped; one vehicle or two, ESP32 installed?, DHT22 location; Pac-Man freeze whom, algorithm, ghost count; reply-time promise; does the site have sound (what, when); which desk props are real; why Japanese; playlist link; analytics exactly Vercel only; mention closed PRs?; name the browser extension from résumé?; Frogtoberfest line?; pursue/mailer/group-continuous-dates worth an "also" line?; capitalisation of titles.

## Revised copy
Critic's v2 draft adopted into `specs/02-copy.md` v2 with the design-critique changes (title block, no `#now`, cv, colophon, Nepali signage or none).
