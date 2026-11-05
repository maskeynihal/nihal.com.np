# Contributing

This repository follows the execution and review loop in [docs/process/review-loop.md](docs/process/review-loop.md). Read it, the [build brief](docs/process/build-brief.md) and the ticket in [docs/tickets/tickets.md](docs/tickets/tickets.md) before changing anything.

## Per change

1. Work from a ticket. One ticket, one commit: `[<ID>] <summary>`.
2. Add or update the ticket's Playwright spec, tagged `@<ID>`. Call `expectNoAxeViolations` on every page state the ticket adds. Never skip or weaken a test to make it pass.
3. Run `pnpm verify` and `pnpm review <ID>`; both must exit 0.
4. Use only copy from [docs/specs/02-copy.md](docs/specs/02-copy.md) and `src/content`. Never invent facts about the owner.
5. A reviewer who did not write the change records a verdict in `docs/reviews/<ID>-r<N>.md`.

## Rules worth repeating

- Output is static HTML. React is allowed only for the Desk canvas and the contact form.
- Do not edit `package.json` or the lockfile as part of an unrelated ticket; dependency changes get their own commit.
- Do not push, and do not change Vercel or branch-protection settings, without the owner's approval.
- TypeScript stays on 6.x; see the README.
