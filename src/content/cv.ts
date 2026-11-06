import type { CvRow } from './schema';

/** CV table, from docs/specs/02-copy.md section 3 (#cv). Bullets are plain text under each role. */
export const cv: CvRow[] = [
  {
    when: '2025 →',
    role: 'lead engineer',
    org: 'Leapfrog Technology',
    details: [
      'Lead the engineering team for a US behavioural-health platform.',
      'Own the AWS architecture for sensitive health data under HIPAA and SOC 2.',
      'Mentor engineers and set code review and security practice.',
      'Work with product and design on what ships next.',
    ],
    confirmed: true,
  },
  {
    when: '2023 → 2025',
    role: 'senior software engineer',
    org: 'Leapfrog Technology',
    details: [
      'Coordinated work across teams in the US, Australia and Nepal.',
      'Cut the frontend bundle by 20% with tree-shaking and memoisation.',
      'Made key backend APIs more than twice as fast.',
      'Automated backups, metrics and notifications with SQS, EventBridge, Lambda and Step Functions.',
      'Shaped the technical roadmap and wrote user stories.',
    ],
    confirmed: true,
  },
  {
    when: '2021 → 2023',
    role: 'software engineer',
    org: 'Leapfrog Technology',
    details: [
      'Led a team of more than 15 across development, design, DevOps and QA.',
      'Planned releases with product owners and shipped major versions.',
      'Main contact for stakeholders and management.',
    ],
    confirmed: true,
  },
  {
    when: '2020 → 2021',
    role: 'associate software engineer',
    org: 'Leapfrog Technology',
    details: [
      'Built features with senior engineers and product owners.',
      'Tracked down root causes in production bugs.',
      'Built a browser extension the team used daily.',
    ],
    confirmed: true,
  },
  {
    when: '2020',
    role: 'software engineer intern',
    org: 'Leapfrog Technology',
    details: [
      'Learned JavaScript and the canvas API by rebuilding Pac-Man with path-finding ghosts.',
      'First steps in Node.js and React.',
    ],
    confirmed: true,
  },
  {
    when: '2019 → 2020',
    role: 'web application developer',
    org: 'Technorio, Kathmandu',
    details: [
      'Shipped web apps for insurance management, video streaming and ticketing.',
      'Set up GitHub Actions deploys.',
      'Worked with business development on estimates.',
    ],
    confirmed: true,
  },
];
