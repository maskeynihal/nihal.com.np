import type { Copy } from './schema';

/**
 * Interface copy, from docs/specs/02-copy.md section 3. Validated by `Copy` at build.
 * Fragments still marked [CONFIRM]/[ASK] in the spec are not here: they live in
 * `pending.ts` (build-time only) and the displayed sentence keeps only its confirmed part.
 * Client scripts must not import this file; use `client-copy.ts`.
 * Templates use {braces}: {merged} {closed} {date} {year}.
 */
export const copy = {
  nav: {
    label: 'sheet index',
    rows: [
      'desk',
      'work',
      'open source',
      'writing',
      'cv',
      'contact',
      'colophon',
    ],
  },
  prefs: {
    motion: 'reduce motion',
    sound: 'sound',
    on: 'on',
    off: 'off',
    system: 'set by your system',
  },
  titleBlock: {
    name: 'nihal maskey',
    selected: 'A',
    options: {
      A: "I'm a software engineer in Kathmandu. I lead a team at Leapfrog Technology that builds healthcare software on AWS, and I make tools I needed and could not find.",
      B: "Lead engineer at Leapfrog Technology, a software services company in Kathmandu. Since 2023 I've worked on one US behavioral-health platform, mostly on the AWS side. Everything else on this sheet is a side project.",
      C: 'Software engineer, Kathmandu. Days: a healthcare platform on AWS for Leapfrog Technology. Evenings: the things on this sheet.',
    },
    email: 'contact@nihal.com.np',
    timeLabel: 'kathmandu · utc+5:45',
    dragHint: 'drag things around. tap one to jump to its section.',
    reset: 'reset the desk',
    skip: 'skip the 3D desk',
    oledCaption: 'demo values',
  },
  headings: {
    work: 'work',
    openSource: 'open source',
    writing: 'writing',
    cv: 'cv',
    contact: 'contact',
  },
  work: {
    play: 'play',
    leave: 'esc to leave',
    openNewTab: 'open the game in a new tab',
  },
  openSource: {
    intro:
      "Pull requests merged into other people's repositories. Counts come from the GitHub API at build time.",
    columns: ['repo', 'what', 'merged'],
    footer: '{merged} merged, {closed} closed without merging, as of {date}.',
  },
  writing: {
    intro:
      'Posts on Hashnode since 2022. Four are server and Laravel notes; the latest is the Arduino monitor.',
    all: 'all posts on hashnode',
    allHref: 'https://nihalmaskey.hashnode.dev',
  },
  cv: {
    note: 'Leapfrog Technology is a software services company in Kathmandu.',
  },
  contact: {
    lead: 'Email works best.',
    copied: 'copied',
    overlap: 'Kathmandu is UTC+5:45 with no daylight saving.',
    socials: [
      { label: 'github', href: 'https://github.com/maskeynihal' },
      { label: 'linkedin', href: 'https://www.linkedin.com/in/maskeynihal' },
      { label: 'x', href: 'https://x.com/nihalmaskey' },
    ],
    form: {
      name: 'your name',
      email: 'your email',
      subject: "what's this about",
      message: 'message',
      send: 'send',
    },
    success: "Sent. I'll reply from contact@nihal.com.np.",
    errors: {
      email: "That email doesn't look right.",
      message: 'Add a sentence or two.',
      network: "Didn't send. Email me directly: contact@nihal.com.np",
    },
  },
  colophon: {
    owner: 'Nihal Maskey',
    copyright: '© {year} Nihal Maskey.',
    source: 'Source on GitHub.',
    sourceHref: 'https://github.com/maskeynihal/nihal.com.np',
  },
  meta: {
    title: 'nihal maskey · lead engineer, kathmandu',
    description:
      'Lead engineer in Kathmandu. Leads a team at Leapfrog Technology that builds healthcare software on AWS, and makes small tools on the side.',
    ogAlt: 'nihal maskey, lead engineer, kathmandu',
  },
  notFound: {
    heading: 'nothing here',
    sheet: 'sheet not found',
    body: 'That page moved or never existed.',
    back: 'back to the desk',
  },
  sent: {
    heading: 'sent',
    body: "I'll reply from contact@nihal.com.np.",
    back: 'back to the desk',
  },
  status: {
    loading: 'loading 3D',
    off: '3D is off on this device. Everything still works.',
    lost: "3D paused. Reload if it doesn't come back.",
  },
  consoleLine:
    'hi. source: github.com/maskeynihal/nihal.com.np. press R with the desk focused to reset it.',
} satisfies Copy;
