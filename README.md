# nihal.com.np

Personal site of Nihal Maskey, built as one blue engineering-drawing sheet. Static HTML from Astro; the only React islands are the 3D desk (`client:only`) and the contact form.

## Stack

| Layer     | Choice                                                                                 |
| --------- | -------------------------------------------------------------------------------------- |
| Framework | Astro 7, static output, no adapter                                                     |
| UI        | React 19 (Desk and ContactForm islands only), vanilla hoisted scripts elsewhere        |
| 3D        | three, `@react-three/fiber`, drei, `@react-three/rapier` (physics loads on first grab) |
| Styles    | Tailwind CSS 4 over CSS custom-property tokens (`src/styles/tokens.css`)               |
| Language  | TypeScript, `astro/tsconfigs/strictest`                                                |
| Content   | Typed modules in `src/content`, validated with zod at build                            |
| Tests     | Vitest (unit), Playwright (e2e, six projects), axe-core, Lighthouse CI                 |
| Hosting   | Vercel (static); headers and CSP generated into `vercel.json`                          |

Requires Node 24 (`.nvmrc`) and pnpm 10 (`packageManager` in `package.json`).

## Commands

| Command                                        | What it does                                                                                  |
| ---------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `pnpm dev`                                     | Astro dev server                                                                              |
| `pnpm build`                                   | Production build into `dist/`; also rewrites `vercel.json`                                    |
| `pnpm preview`                                 | Serve `dist/`                                                                                 |
| `pnpm lint` / `pnpm format` / `pnpm typecheck` | ESLint, Prettier check, `astro check`                                                         |
| `pnpm test`                                    | Vitest unit tests                                                                             |
| `pnpm check`                                   | Post-build gates: initial JS graph, content leaks, copy gate, dist copy                       |
| `pnpm verify`                                  | Everything above in order; the pre-commit bar                                                 |
| `pnpm review <ID>`                             | Builds with test hooks, runs Playwright specs tagged `@<ID>` (for example `pnpm review A-09`) |
| `pnpm review:all`                              | Whole Playwright suite                                                                        |
| `pnpm github:fetch`                            | Refresh `src/content/generated/github.json` (falls back to the committed file)                |
| `pnpm fonts`                                   | Rebuild the subset, instanced fonts                                                           |
| `pnpm lhci`                                    | Lighthouse CI against `dist/`                                                                 |

## Layout

- `src/pages`, `src/layouts`, `src/components`: Astro markup. Every readable word is in the built HTML.
- `src/content`: all copy and data. Items with `confirmed: false` stay out of the build.
- `scripts`: build-time tooling, including `write-vercel-json.ts` (CSP hashes, run after every build) and the copy gate.
- `e2e`: Playwright specs. `e2e/header-server.ts` serves `dist/` with the production headers for `@A-09`.
- `docs`: specs, tickets, process and review files.

## Content security policy

`vercel.json` is generated: after each build the integration in `astro.config.ts` hashes every inline script in `dist/**/*.html` and writes the header set from spec section 9. Commit the regenerated file when it changes. A `build:e2e` build writes `.astro/vercel.e2e.json` instead.

## Why TypeScript is pinned to 6.x

`typescript` is held at `^6.0.3`. `typescript-eslint` and `@astrojs/check` do not support TypeScript 7 yet, so a 7.x bump fails lint and typecheck. `renovate.json` blocks major `typescript` updates until both tools list support; lift the rule then.

## Working agreements

See [CONTRIBUTING.md](CONTRIBUTING.md) and [docs/process/review-loop.md](docs/process/review-loop.md). Specs are in [docs/specs](docs/specs); tickets in [docs/tickets/tickets.md](docs/tickets/tickets.md).
