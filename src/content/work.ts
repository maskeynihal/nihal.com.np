import type { WorkItem } from './schema';

/** Five work panels, from docs/specs/02-copy.md section 3 (#work). */
export const work: WorkItem[] = [
  {
    id: 'trayt',
    title: 'trayt health',
    dateLine: 'jan 2025 → · lead engineer',
    meta: 'Leapfrog Technology, for Trayt Health',
    body: [
      'A behavioral-health platform for psychiatry access programs and managed care organizations. I joined the project as a senior engineer in 2023 and have led the engineering team since January 2025. My own code is mostly on AWS: SQS, EventBridge, Lambda and Step Functions for backups, metrics and notifications, plus the HIPAA and SOC 2 work that comes with health data.',
      'The team sits in Nepal, Australia and the US.',
    ],
    frameNote: 'Client work, so there is no code to link. Ask me about it.',
    links: [],
    confirmed: false,
    pending: [
      '[CONFIRM] whether the client name "Trayt Health" may appear (title, meta, cv).',
      "[ASK] one sentence on what was actually hard, in the owner's words.",
      '[CONFIRM] numbers before adding: 20% smaller frontend bundle, API response times over 200% faster, and how each was measured.',
    ],
  },
  {
    id: 'tz-converter',
    title: 'tz converter',
    dateLine: 'nov 2026 · 0.8.1 in the chrome web store and firefox add-ons',
    meta: 'Chrome, Edge, Brave, Firefox',
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
      { label: 'tz.nihal.com.np', href: 'https://tz.nihal.com.np/' },
      { label: 'GitHub', href: 'https://github.com/maskeynihal/tz-extension' },
    ],
    confirmed: true,
    pending: ['[ASK] hardest part, one sentence.'],
  },
  {
    id: 'space-hog',
    title: 'space hog',
    dateLine: 'oct 2026 · rust, egui',
    meta: 'macOS, Linux',
    body: [
      'A desktop app that shows what is using your disk: largest files, drill-down by folder, breakdown by file type, cache cleanup suggestions, and a CLI mode. Universal build for macOS, and Linux.',
    ],
    links: [
      { label: 'GitHub', href: 'https://github.com/maskeynihal/space-hog' },
    ],
    confirmed: true,
    pending: ['[ASK] hardest part; largest volume tested.'],
  },
  {
    id: 'car-sensors',
    title: 'car sensors',
    dateLine: 'oct 2026 · arduino uno r4 wifi',
    meta: 'Arduino UNO R4 WiFi',
    body: [
      'Firmware for car sensors. A UNO R4 reads water temperature from a DS18B20 and air temperature and humidity from a DHT22, shows them on a small OLED, and sounds a buzzer on alarm. The repo is set up so a coding agent can build and run the firmware in a Wokwi emulator on a Mac before anything is flashed to the car. The buzzer jammed because tone() and digitalWrite() were driving the same pin, which took a while to find.',
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
    pending: [
      '[CONFIRM] vehicle details held back: two Land Cruisers; LC78 for the UNO R4 unit; HJ60 with an ESP32-S3 reading the factory coolant sender and drawing temperature on a TFT. Vehicle ownership is unverified in the profile.',
    ],
  },
  {
    id: 'pac-man',
    title: 'pac-man',
    dateLine: 'aug 2020 · javascript, canvas',
    meta: 'Leapfrog internship project',
    body: [
      'My internship project at Leapfrog, written to learn JavaScript and the canvas API. Easy, medium and hard modes, three power-ups (Red Cherry, Ghost Wrap, Blue Dot), and a two-player mode on WASD with a freeze and unfreeze mechanic. The ghosts use path-finding rather than random movement. You can play it here.',
    ],
    links: [
      { label: 'GitHub', href: 'https://github.com/maskeynihal/pacman' },
      {
        label: 'play standalone',
        href: 'https://maskeynihal.github.io/pacman/',
      },
    ],
    confirmed: true,
    pending: [
      '[ASK] who gets frozen in two-player mode.',
      '[ASK] which path-finding algorithm.',
    ],
  },
];
