import type { WorkGroup, WorkItem } from './schema';

/** The groups the project cards sit in, in page order. A group with no visible card is skipped. */
export const workGroups: WorkGroup[] = [
  {
    id: 'client',
    title: 'client work',
    note: 'Code I cannot publish.',
  },
  {
    id: 'products',
    title: 'products and tools',
    note: 'Software other people use. Each has its own page.',
  },
  {
    id: 'hardware-games',
    title: 'hardware and games',
    note: 'A microcontroller and a canvas game.',
  },
];

/** Seven project cards (#work-<id>), grouped by `group`. Primary link: the project's own site, else its repo. */
export const work: WorkItem[] = [
  {
    id: 'trayt',
    group: 'client',
    title: 'trayt health',
    dateLine: 'jan 2025 → · lead engineer',
    meta: 'Leapfrog Technology, for Trayt Health',
    summary:
      'A US health-tech platform. I have led the engineering team since January 2025.',
    tags: ['health tech', 'design', 'leadership'],
    body: [
      'A US health-tech platform. I joined the project as a senior engineer in 2023 and have led the engineering team since January 2025, owning its architecture and the security and compliance work around sensitive health data.',
      'The team sits in Nepal, Australia and the US.',
    ],
    frameNote: 'Client work under NDA. Happy to talk through the architecture.',
    links: [],
    confirmed: false,
  },
  {
    id: 'tz-converter',
    group: 'products',
    title: 'tz converter',
    dateLine: 'nov 2026 · 0.8.1 in the chrome web store and firefox add-ons',
    meta: 'Chrome, Edge, Brave, Firefox',
    summary:
      'Select a time on any page and see it in the zones you chose. Also a full converter, an epoch converter and a world clock.',
    tags: ['TypeScript', 'Manifest V3', 'Chrome', 'Firefox'],
    cta: { label: 'visit tz.nihal.com.np', href: 'https://tz.nihal.com.np/' },
    body: [
      "A browser extension, TypeScript, Manifest V3. Select a time on a page and a popover shows it in the zones you've chosen. It also has a full converter, an epoch converter, right-click convert, custom date formats, and a world clock at tz.nihal.com.np/clock. I built it because the people I work with are in Nepal, Australia and the US.",
    ],
    links: [
      {
        label: 'Chrome Web Store',
        href: 'https://chromewebstore.google.com/detail/tz-converter-%E2%80%94-timezone-t/cokhjgalkhboifkgoomlbaigocjpmhkk',
      },
      {
        label: 'Firefox Add-ons',
        href: 'https://addons.mozilla.org/en-US/firefox/addon/tz-converter-timezone-tools/',
      },
      { label: 'GitHub', href: 'https://github.com/maskeynihal/tz-extension' },
    ],
    confirmed: true,
  },
  {
    id: 'sprintnudge',
    group: 'products',
    title: 'sprintnudge',
    dateLine: 'oct 2026 · free during early access',
    meta: 'Web',
    summary:
      'We built a retrospective board for software teams: private brainstorming, anonymous cards, voting, and action items that come back at the next retro.',
    tags: ['TypeScript', 'React', 'Convex', 'Web'],
    cta: { label: 'visit sprintnudge.com', href: 'https://sprintnudge.com/' },
    body: [
      'We built a real-time retrospective board for distributed teams. People add cards, anonymously if they want, then group and vote on them, talk through the top topics and agree action items. The facilitator can turn phases on or off and run a shared timer. We enforce anonymity on the server.',
      'Action items have owners, due dates and a history, and show up again in the next retro. They can become Jira or GitHub issues, and Slack and Microsoft Teams get notifications. Our frontend is React 19 and our backend is Convex, with Clerk for sign-in. The source is in a private repository.',
    ],
    links: [],
    confirmed: true,
  },
  {
    id: 'underhood',
    group: 'products',
    title: 'underhood',
    dateLine: 'oct 2026 · installable web app',
    meta: 'Web, installs as a PWA',
    summary:
      'Service, fuel, expenses, reminders and complaints for every vehicle you own. Works offline on a phone.',
    tags: ['TypeScript', 'React', 'PWA', 'Postgres'],
    cta: {
      label: 'visit underhood.nihal.com.np',
      href: 'https://underhood.nihal.com.np/',
    },
    body: [
      'A vehicle record for cars and bikes. Log fill-ups with the odometer to see real km/L, keep itemised service invoices, set reminders by date or distance, whichever comes first, and keep a complaints list to show a mechanic. A vehicle can be shared read-only with a friend.',
      'An installable offline-capable PWA in React and Vite, with a Next.js marketing site, in a Turborepo monorepo. Data is in Neon Postgres with row-level security. The source is in a private repository.',
    ],
    links: [],
    confirmed: true,
  },
  {
    id: 'space-hog',
    group: 'products',
    title: 'space hog',
    dateLine: 'oct 2026 · rust, egui',
    meta: 'macOS, Linux',
    summary:
      'A desktop app that shows what is using your disk, with folder drill-down, a file-type breakdown and a CLI mode.',
    tags: ['Rust', 'egui', 'macOS', 'Linux'],
    cta: {
      label: 'view on GitHub',
      href: 'https://github.com/maskeynihal/space-hog',
    },
    body: [
      'A desktop app that shows what is using your disk: largest files, drill-down by folder, breakdown by file type, cache cleanup suggestions, and a CLI mode. Universal build for macOS, and Linux.',
    ],
    links: [],
    confirmed: true,
  },
  {
    id: 'car-sensors',
    group: 'hardware-games',
    title: 'car sensors',
    dateLine: 'oct 2026 · arduino uno r4 wifi',
    meta: 'Arduino UNO R4 WiFi',
    summary:
      'Firmware that reads water and air temperature, shows it on an OLED and sounds a buzzer on alarm.',
    tags: ['C', 'Arduino', 'DS18B20', 'DHT22'],
    cta: {
      label: 'project page',
      href: 'https://maskeynihal.github.io/sensor-for-cars/',
    },
    body: [
      'Firmware for car sensors. A UNO R4 reads water temperature from a DS18B20 and air temperature and humidity from a DHT22, shows them on a small OLED, and sounds a buzzer on alarm. The repo is set up so a coding agent can build and run the firmware in a Wokwi emulator on a Mac before anything is flashed to the car. I traced a jammed buzzer to tone() and digitalWrite() driving the same pin.',
    ],
    links: [
      {
        label: 'GitHub',
        href: 'https://github.com/maskeynihal/sensor-for-cars',
      },
      {
        label: 'the write-up on Hashnode',
        href: 'https://nihalmaskey.hashnode.dev/i-built-a-water-air-monitor-on-an-arduino-and-the-buzzer-tried-to-kill-me',
      },
    ],
    confirmed: true,
  },
  {
    id: 'pac-man',
    group: 'hardware-games',
    title: 'pac-man',
    dateLine: 'aug 2020 · javascript, canvas',
    meta: 'Leapfrog internship project',
    summary:
      'My Leapfrog internship project: a canvas game with three modes, power-ups, two players and ghosts that path-find.',
    tags: ['JavaScript', 'Canvas', 'Browser'],
    body: [
      'My internship project at Leapfrog, written to learn JavaScript and the canvas API. Easy, medium and hard modes, three power-ups (Red Cherry, Ghost Wrap, Blue Dot), and a two-player mode on WASD with a freeze and unfreeze mechanic. The ghosts use path-finding rather than random movement. You can play it here.',
    ],
    arcade: { href: 'https://maskeynihal.github.io/pacman/' },
    links: [{ label: 'GitHub', href: 'https://github.com/maskeynihal/pacman' }],
    confirmed: true,
  },
];
