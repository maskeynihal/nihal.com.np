# Build brief for implementer agents (review deferred)

Read with: docs/tickets/tickets.md (your tickets, DoD, carry-overs, "Review deferral"), docs/specs/01-design-spec.md, docs/specs/02-copy.md, docs/specs/03-implementation-spec.md, docs/process/review-loop.md (gates).

## Rules
- Production grade. No stubs left behind unless a later ticket is named for them in a code comment (`// replaced in <ID>`).
- One commit per ticket: `[<ID>] <summary>`, ending with the line `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Never push.
- Before each commit: `pnpm verify` exit 0 and `pnpm review <ID>` exit 0. A tagged Playwright spec `@<ID>` per ticket, calling `expectNoAxeViolations` on new states. Never skip or weaken a test to pass.
- Do not edit `package.json` or `pnpm-lock.yaml`. All dependencies are installed. If one is truly missing, stop and report.
- Stay in your tickets' files. Do not refactor other tickets' code beyond what your ticket needs.
- Copy: use only text from docs/specs/02-copy.md and src/content. Items `confirmed:false` stay hidden (getters already do this). Never invent facts about the owner. The copy gate must pass.

## SEO and static output (owner requirement)
- Output is static HTML from Astro. Every readable word (name, sections, work, open source, writing, cv, contact, colophon, object list) must be in the built HTML, rendered by `.astro` components.
- React only for the Desk canvas (`client:only="react"`) and ContactForm (server-rendered island, `client:visible`, never `client:only`; native `<form action method>` in the HTML so no-js post works).
- No readable text that exists only inside a client:only island. ObjectList is Astro markup outside `<Desk>`.
- Semantic HTML: one h1, ordered headings, landmarks, real links (`<a href>`), tables for tabular data, `<time datetime>`.
- Keep JSON-LD, canonical, meta and sitemap from A-06 correct as sections are added.

## Report back
Commit hashes, files, exact gate tails (`pnpm verify`, `pnpm review <ID>` counts), decisions, anything not done and why.
