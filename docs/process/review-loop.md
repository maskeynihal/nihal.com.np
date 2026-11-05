# Execution and review loop v2

Runs after the owner approves the plan. Updated per `reviews/plan-critique-02-engineering.md` B4.

## Roles (subagents of the orchestrating session)
- **Implementer**: one ticket. Reads specs 00-03, the ticket, the profile, prior review files for that ticket. Writes code + the ticket's tagged Playwright spec + unit tests. Commits `[ID] message`. Report: what changed, commands run with exit codes, what it could not verify.
- **Reviewer**: fresh agent, never the implementer. Gets the diff, ticket, specs. Runs `pnpm review <ID>` (builds with hooks, previews, runs `--grep @<ID>`, writes report dir). Three passes, then one verdict line in `docs/reviews/<ID>-r<N>.md`: `VERDICT: Ready to Ship` or `VERDICT: Changes Required`.
  1. Code: correctness, every acceptance line, edge cases, types (no `any`, no ts-ignore), leaks (listeners, intervals, GL objects), error paths, a11y attributes, `check:graph` output.
  2. Smoke: drives the preview in the browser pane; checks each acceptance line with evidence (screenshot path in the report dir or command output); verifies console clean.
  3. Gates: design slop §10 on screenshots; copy §2 reviewer-only rules on touched copy.
- **Adversarial QA** (per epic before merge): resize mid-drag, toggle motion mid-animation, rotate phone, kill WebGL via hook, CPU 6× + slow 3G, tab away/back, Tab through blind, 10 kB paste in the form, double "play", spam `R`, 320 px, 400% zoom, Firefox, Safari. Files findings as tickets or blockers.

## Loop
```
for ticket in epic (dependency order):
  implementer(ticket) -> diff
  n = 1
  loop:
    reviewer(diff, ticket, n) -> verdict
    if Ready to Ship: break
    implementer(ticket, findings) -> diff; n += 1
    if n > 4: stop; escalate to owner with the findings
epic PR: adversarialQA -> fixes via the same loop -> CI green ×3 -> merge
```
Only the verdict file counts. Reviewers do not fix code.

## Verdict rules
Ready to Ship only if every acceptance line has evidence, DoD met, no Blocker/Major open. Blocker: breaks acceptance, data loss, a11y failure, console error, budget miss. Major: unhandled edge, slop hit, missing test. Minor: naming, comments (listed, not blocking).

## Evidence
Commands + exit codes; Playwright report path (CI artifact URL when in CI); screenshot paths; lhci JSON path with LCP/CLS/TBT. Screenshots are **not** committed except one set per epic in `docs/reviews/shots/<epic>/`.

## Owner checkpoints
1. Plan approval (now). 2. After Epic A + B: static page on preview; answer [CONFIRM]/[ASK]. 3. After Epic E: play with the drawing on a phone and a laptop. 4. Before F-05.

## Manual gates (humans or device-capable agent)
Real iPhone Safari, real Android Chrome, VoiceOver, NVDA, 400% zoom, high contrast, print, 5-minute iOS soak.
