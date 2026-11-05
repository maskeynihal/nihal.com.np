import type { CvRow } from './schema';

/** CV table, from docs/specs/02-copy.md section 3 (#cv). */
export const cv: CvRow[] = [
  {
    when: '2025 →',
    role: 'lead engineer',
    org: 'Leapfrog Technology',
    confirmed: true,
    pending: ['[CONFIRM] append ", for Trayt Health" to org.'],
  },
  {
    when: '2023 → 2025',
    role: 'senior software engineer',
    org: 'Leapfrog Technology',
    confirmed: true,
    pending: ['[CONFIRM] append ", for Trayt Health" to org.'],
  },
  {
    when: '2021 → 2023',
    role: 'software engineer',
    org: 'Leapfrog Technology',
    confirmed: true,
  },
  {
    when: '2020 → 2021',
    role: 'associate software engineer',
    org: 'Leapfrog Technology',
    confirmed: true,
  },
  {
    when: '2020',
    role: 'intern',
    org: 'Leapfrog Technology',
    confirmed: true,
  },
  {
    when: '2019 → 2020',
    role: 'web application developer',
    org: 'Technorio, Kathmandu',
    confirmed: true,
  },
  {
    when: '2021',
    role: 'BE computer engineering',
    org: 'Kantipur Engineering College, Tribhuvan University',
    confirmed: true,
  },
];
