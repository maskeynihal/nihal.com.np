# 00. Product brief: nihal.com.np rebuild (2026)

Status: v2 for owner approval. Date 2026-11-05. Budgets revised after `reviews/plan-critique-02-engineering.md`.

## What this is
A full replacement of nihal.com.np. The current site (Next.js, v0-generated, card grid) is discarded. Only its facts carry over, re-verified in `docs/profile/nihal-maskey.md`. No visual, structural or code inspiration is taken from the current codebase or from the abandoned `feat/award-rebuild-2026` branch.

## Who it is for
1. **Hiring managers and founders** (US, Australia, Europe) who got the link from LinkedIn, GitHub or email. Need in under 60 seconds: what Nihal does, proof, how to reach him, when he is awake.
2. **Engineers** who land from a GitHub README, a Hashnode post, an nginxconfig.io PR, or the TZ Converter store page. Want to poke around, find the code, maybe stay and play.
3. **Award jurors** (Awwwards, CSSDA, FWA) judging Design 40 / Usability 30 / Creativity 20 / Content 10 and the developer rubric (semantics, animation, accessibility, performance, responsive, markup). Browse on phones too.

## Goals
- G1. A visitor who scrolls once knows: Nihal Maskey, lead engineer at Leapfrog in Kathmandu, healthcare backend on AWS, builds tools on the side, here is the email, it is 14:32 there.
- G2. Something to play with that is *his*: real objects from his real work, not abstract shapes. Visitors stay longer than they need to.
- G3. Award-grade craft: one signature idea, motion with intent, typographic confidence, native scroll, 60 fps, mobile parity.
- G4. Zero AI-slop tells, visual or verbal (gates in `02-copy.md` and `01-design-spec.md` §10).
- G5. Production grade: passes Core Web Vitals, WCAG 2.2 AA, works with no WebGL, no JS, reduced motion, keyboard only, screen reader, slow 3G, iOS Safari.

## Non-goals
- Not a blog platform. Writing section links to Hashnode.
- No CMS, no database, no auth, no server runtime. Static output.
- No dark/light theme pair. One brand theme (blue) with paper reading panels, plus a "plain" mode. Not a third theme.
- No invented facts, metrics, testimonials, logos of clients that were not disclosed.
- No sound by default. Optional, off.

## Success measures
| Measure | Target |
|---|---|
| LCP (mobile, p75 lab) | <= 2.0 s |
| INP | <= 150 ms |
| CLS | <= 0.05 |
| Initial JS (brotli) | <= 100 KB |
| Desk chunk (brotli, lazy after idle) | <= 320 KB; models <= 150 KB separately |
| Physics chunk (brotli, loads only on first grab) | measured in E-11, expected 650-800 KB; never in first view |
| Fonts (two families, instanced) | <= 130 KB |
| Total transfer first view, mobile, before physics | <= 900 KB |
| Lighthouse (mobile) | Perf >= 90, A11y 100, Best Practices 100, SEO 100 |
| axe violations | 0 |
| Copy gate (banned words) | 0 matches |
| Frame rate during interaction, mid-range Android (Pixel 6a class) | >= 50 fps sustained |
| Time-to-contact: clicks from landing to a mailto/copy | 1 |

## Constraints
- Owner stack comfort: TypeScript, React. Deploy: Vercel (existing analytics). Domain nihal.com.np stays. Formspree endpoint stays (`xanoenzo`) unless replaced.
- Colour and type direction from lahin-kit: Klein blue `#1F3FE0`, white ink, white line art, Fraunces + JetBrains Mono (Inter dropped after critique), radius 6 px, paper panels. Fonts self-hosted.
- Facts only from `docs/profile/nihal-maskey.md`. UNVERIFIED items need owner confirmation before they appear.

## Open questions for the owner
Design: `01-design-spec.md` §12. Copy facts: `profile/nihal-maskey.md` "Questions for Nihal" plus the additions in `reviews/plan-critique-03-copy.md`. None block Epic A or D-02.
