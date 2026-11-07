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
      'about',
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
    kicker: 'lead software engineer · kathmandu, nepal',
    selected: 'A',
    options: {
      A: 'I lead an engineering team at Leapfrog Technology that builds a US behavioural-health platform on AWS. I co-founded Daboo Spaces, a coworking space in Sankhamul. The rest of this sheet is things I built because I wanted them.',
      B: "Lead engineer at Leapfrog Technology, a software services company in Kathmandu. Since 2023 I've worked on one US behavioral-health platform, mostly on the AWS side. Everything else on this sheet is a side project.",
      C: 'Software engineer, Kathmandu. Days: a healthcare platform on AWS for Leapfrog Technology. Evenings: the things on this sheet.',
    },
    email: 'contact@nihal.com.np',
    timeLabel: 'kathmandu · utc+5:45',
    revLine: 'rev {rev} · sheet 1 of 1 · scale 1:1',
    seeWork: 'see the work →',
    dragHint: 'pick something up. throw it off the table if you like.',
    reset: 'put everything back',
    skip: 'skip the 3D desk',
    oledCaption: 'demo values',
  },
  headings: {
    about: 'about',
    work: 'work',
    openSource: 'open source',
    writing: 'writing',
    cv: 'cv',
    contact: 'contact',
  },
  about: {
    paragraphs: [
      "I'm a software engineer in Kathmandu, Nepal. I've been building for the web since 2019, the last six at Leapfrog Technology, where I went from intern to lead engineer.",
      'Today I lead the team behind a US behavioural-health platform. The work is mostly TypeScript, React, Node.js and AWS: queues, Lambdas and Step Functions, with patient data that has to meet HIPAA and SOC 2. I care about fast pages, boring deploys and code the next person can read.',
      'I work with people in the US, Australia and Nepal, so a lot of my job is writing things down clearly and running reviews that teach something.',
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
      { label: 'stack', value: 'TypeScript, React, Node.js, Laravel, AWS' },
      {
        label: 'open to',
        value: 'mentorship, consulting, talks',
      },
    ],
  },
  work: {
    intro: 'Side projects, each built to fix something that annoyed me.',
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
    intro:
      'Since 2019: two companies, and a long climb at Leapfrog from intern to lead.',
    note: 'Leapfrog Technology is a software services company in Kathmandu.',
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
        title: 'What I work with',
        text: 'TypeScript, JavaScript, React, Node.js, Laravel, PHP, AWS (Lambda, SQS, EventBridge, Step Functions), PostgreSQL, MySQL, HIPAA and SOC 2 work, team leadership.',
      },
    ],
  },
  contact: {
    lead: 'Email is fastest. I read everything and reply to most within a couple of days.',
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
    built:
      'Built with Astro and three.js. The desk is code, not a model file from a store.',
  },
  meta: {
    title: 'Nihal Maskey · Lead Software Engineer in Kathmandu, Nepal',
    description:
      'Nihal Maskey is a lead software engineer in Kathmandu, Nepal. He builds healthcare software on AWS at Leapfrog Technology and co-founded Daboo Spaces.',
    keywords:
      'Nihal Maskey, software engineer in Nepal, software engineer Kathmandu, best software engineers in Nepal, lead engineer Nepal, team lead Nepal, team lead Kathmandu, lead engineer at Leapfrog Technology, software engineer at Trayt, healthcare software engineer, health tech engineer Nepal, full stack developer Nepal, React developer Nepal, Node.js developer Kathmandu, TypeScript engineer, AWS engineer Nepal, Laravel developer Nepal, engineering manager Nepal, Daboo Spaces co-founder',
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
    description: "Sent. I'll reply from contact@nihal.com.np.",
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
