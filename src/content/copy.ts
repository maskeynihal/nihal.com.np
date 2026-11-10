import type { Copy } from './schema';

/**
 * Interface copy, from docs/specs/02-copy.md section 3. Validated by `Copy` at build.
 * Fragments still marked [CONFIRM]/[ASK] in the spec are not here: they live in
 * `pending.ts` (build-time only) and the displayed sentence keeps only its confirmed part.
 * Client scripts must not import this file; use `client-copy.ts`.
 * Templates use {braces}: {year}.
 */
export const copy = {
  nav: {
    label: 'sheet index',
    rows: [
      'desk',
      'about',
      'projects',
      'open source',
      'writing',
      'cv',
      'contact',
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
    kicker: 'lead software engineer · kathmandu, nepal',
    line: 'Lead engineer at Leapfrog Technology. I lead the team that designs and ships health-tech software, from architecture to production. Co-founder of Daboo Spaces, a coworking space in Kathmandu.',
    email: 'contact@nihal.com.np',
    timeLabel: 'kathmandu · utc+5:45',
    seeProjects: 'see the projects →',
    reset: 'put everything back',
    skip: 'skip the 3D desk',
    oledNote: 'the oled readings are demo values',
  },
  headings: {
    about: 'about',
    projects: 'projects',
    openSource: 'open source',
    writing: 'writing',
    cv: 'cv',
    contact: 'contact',
  },
  about: {
    paragraphs: [
      "I'm a lead software engineer in Kathmandu, Nepal. I joined Leapfrog Technology as an intern in 2020 and have led engineering teams there since 2021.",
      "Today I lead the engineering team behind a US health-tech platform. I own its architecture and the security and compliance work that comes with sensitive health data. I also mentor engineers, set the team's engineering standards, and work with product and design on what ships next.",
      "I lead across the US, Australia and Nepal, so I write clear specs and run code reviews that raise the team's standard.",
    ],
    daboo: {
      before: 'Outside work I co-founded ',
      link: { label: 'Daboo Spaces', href: 'https://daboospaces.com' },
      after:
        ', a coworking space in Sankhamul, Kathmandu, with desks, private offices and a community of founders, freelancers and remote workers.',
    },
    facts: [
      { label: 'location', value: 'Kathmandu, Nepal' },
      { label: 'role', value: 'Lead Engineer, Leapfrog Technology' },
      { label: 'co-founder', value: 'Daboo Spaces' },
      {
        label: 'focus',
        value: 'Health tech, cloud architecture, engineering leadership',
      },
      {
        label: 'open to',
        value: 'consulting, mentorship, speaking',
      },
    ],
  },
  work: {
    intro:
      'Side projects. Each one solves a problem I hit at work or at home, and each one shipped.',
    play: 'play',
    leave: 'esc to leave',
    openNewTab: 'open the game in a new tab',
    more: 'more',
    stack: 'stack',
    scrollLeft: 'scroll left',
    scrollRight: 'scroll right',
  },
  openSource: {
    columns: ['repo', 'what', 'merged'],
    since: 'since',
    ownHeading: 'my projects',
    contribHeading: 'contributions',
  },
  writing: {
    intro:
      'Practical notes on servers, Laravel and hardware, written after solving the problem.',
    all: 'all posts on hashnode',
    allHref: 'https://nihalmaskey.hashnode.dev',
  },
  cv: {
    cards: [
      {
        label: 'co-founder',
        title: 'Daboo Spaces, Kathmandu',
        text: 'A coworking space in Sankhamul Tower 1.',
      },
      {
        label: 'education',
        title: 'BE computer engineering',
        text: 'Kantipur Engineering College, Tribhuvan University, 2021.',
      },
      {
        label: 'skills',
        title: 'What I work on',
        text: 'Full-stack web products, cloud architecture, security and compliance for sensitive data, and leading and mentoring engineering teams.',
      },
    ],
  },
  contact: {
    lead: 'Email is fastest. I reply within two working days.',
    copied: 'copied',
    overlap: 'Kathmandu is UTC+5:45 with no daylight saving.',
    socials: [
      { label: 'github', href: 'https://github.com/maskeynihal' },
      { label: 'linkedin', href: 'https://www.linkedin.com/in/maskeynihal' },
      { label: 'x', href: 'https://x.com/nihalmaskey' },
      { label: 'instagram', href: 'https://www.instagram.com/maskeynihal' },
      { label: 'hashnode', href: 'https://nihalmaskey.hashnode.dev' },
    ],
    form: {
      name: 'your name',
      email: 'your email',
      subject: "what's this about",
      message: 'message',
      send: 'send message',
    },
    success:
      "Message sent. I'll reply from contact@nihal.com.np within two working days.",
    errors: {
      email: "That email doesn't look right.",
      message: 'Add a sentence or two.',
      network: "Didn't send. Email me directly: contact@nihal.com.np",
    },
  },
  footer: {
    copyright: '© {year} Nihal Maskey.',
    source: 'Source on GitHub.',
    sourceHref: 'https://github.com/maskeynihal/nihal.com.np',
  },
  meta: {
    title: 'Nihal Maskey · Lead Software Engineer in Kathmandu, Nepal',
    description:
      'Nihal Maskey is a lead software engineer in Kathmandu, Nepal. He leads health-tech engineering at Leapfrog Technology and co-founded Daboo Spaces.',
    keywords:
      'Nihal Maskey, software engineer in Nepal, software engineer Kathmandu, lead engineer Nepal, team lead Nepal, team lead Kathmandu, lead engineer at Leapfrog Technology, healthcare software engineer, health tech engineer Nepal, full stack developer Nepal, React developer Nepal, Node.js developer Kathmandu, TypeScript engineer, AWS engineer Nepal, Laravel developer Nepal, engineering manager Nepal, Daboo Spaces co-founder',
    ogAlt: 'Nihal Maskey, lead software engineer, Kathmandu, Nepal',
  },
  notFound: {
    title: 'nothing here · nihal maskey',
    description: 'That page moved or never existed.',
    heading: 'nothing here',
    sheet: 'sheet not found',
    body: 'That page moved or never existed.',
    back: 'back to the desk',
  },
  sent: {
    title: 'sent · nihal maskey',
    description:
      "Message sent. I'll reply from contact@nihal.com.np within two working days.",
    heading: 'sent',
    body: "I'll reply from contact@nihal.com.np within two working days.",
    back: 'back to the desk',
  },
  desk: {
    hint: 'tap anything on the desk',
    dismiss: 'got it',
  },
  status: {
    loading: 'loading 3D',
    off: '3D is off on this device. Everything still works.',
    lost: "3D paused. Reload if it doesn't come back.",
  },
  consoleLine:
    'hi. source: github.com/maskeynihal/nihal.com.np. press R with the desk focused to reset it.',
} satisfies Copy;
