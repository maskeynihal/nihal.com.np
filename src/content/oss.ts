import type { PR } from './schema';

const commits = (repo: string) =>
  `https://github.com/${repo}/commits?author=maskeynihal`;
const repoUrl = (repo: string) => `https://github.com/${repo}`;

/**
 * Open-source rows, one per repo. `own` rows are my public projects (month created, from the
 * GitHub API); `contribution` rows are work merged into other people's repos. Revision-table
 * copy from docs/specs/02-copy.md section 3 (#open-source).
 */
export const oss: PR[] = [
  // --- my projects -------------------------------------------------------------------------
  {
    kind: 'own',
    repo: 'maskeynihal/tz-extension',
    what: 'browser extension that converts times on a page between time zones',
    merged: '2026-10',
    href: repoUrl('maskeynihal/tz-extension'),
  },
  {
    kind: 'own',
    repo: 'maskeynihal/space-hog',
    what: 'Rust desktop app that finds what is filling your disk',
    merged: '2026-10',
    href: repoUrl('maskeynihal/space-hog'),
  },
  {
    kind: 'own',
    repo: 'maskeynihal/sensor-for-cars',
    what: 'Arduino firmware for car sensors, testable in an emulator',
    merged: '2026-10',
    href: repoUrl('maskeynihal/sensor-for-cars'),
  },
  {
    kind: 'own',
    repo: 'maskeynihal/large-json-diff',
    what: 'compares two large JSON files, with key and array options',
    merged: '2025-06',
    href: repoUrl('maskeynihal/large-json-diff'),
  },
  {
    kind: 'own',
    repo: 'maskeynihal/nihal.com.np',
    what: 'this site, in Astro and TypeScript',
    merged: '2025-05',
    href: repoUrl('maskeynihal/nihal.com.np'),
  },
  {
    kind: 'own',
    repo: 'maskeynihal/effortless',
    what: 'CLI that provisions a server and deploys a Laravel app',
    merged: '2024-05',
    href: repoUrl('maskeynihal/effortless'),
  },
  {
    kind: 'own',
    repo: 'maskeynihal/group-continuous-dates',
    what: 'npm package that groups continuous dates',
    merged: '2022-10',
    href: repoUrl('maskeynihal/group-continuous-dates'),
  },
  {
    kind: 'own',
    repo: 'maskeynihal/pursue',
    what: 'event and job handling on AWS SQS',
    merged: '2022-09',
    href: repoUrl('maskeynihal/pursue'),
  },
  {
    kind: 'own',
    repo: 'maskeynihal/mailer',
    what: 'a small Mail class for sending email, in TypeScript',
    merged: '2022-09',
    href: repoUrl('maskeynihal/mailer'),
  },
  // --- contributions -----------------------------------------------------------------------
  {
    kind: 'contribution',
    repo: 'digitalocean/nginxconfig.io',
    what: 'independent scrolling in split-column mode (#433); prettier via lint-staged (#448)',
    merged: '2023-06 → 2023-10',
    href: commits('digitalocean/nginxconfig.io'),
  },
  {
    kind: 'contribution',
    repo: 'spatie/holidays',
    what: 'Nepal holiday calendar, with tests',
    merged: '2024-10',
    href: 'https://github.com/spatie/holidays/pull/247',
  },
  {
    kind: 'contribution',
    repo: 'kritish-dhaubanjar/dynamodb-dashboard',
    what: '18 commits: validation, download, search fixes, demo videos',
    merged: '2023 → 2026',
    href: commits('kritish-dhaubanjar/dynamodb-dashboard'),
  },
  {
    kind: 'contribution',
    repo: 'kritish-dhaubanjar/dev-auth-chrome-extension',
    what: 'Svelte rewrite, add-user form, token handling',
    merged: '2021 → 2022',
    href: commits('kritish-dhaubanjar/dev-auth-chrome-extension'),
  },
  {
    kind: 'contribution',
    repo: 'benawad/dogehouse',
    what: 'Nepali translation, persist language',
    merged: '2021',
    href: commits('benawad/dogehouse'),
  },
  {
    kind: 'contribution',
    repo: 'supabase/supabase',
    what: 'null-check fix; docs',
    merged: '2021 → 2023',
    href: commits('supabase/supabase'),
  },
];
