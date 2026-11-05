import type { PR } from './schema';

const commits = (repo: string) =>
  `https://github.com/${repo}/commits?author=maskeynihal`;

/** Revision-table rows, from docs/specs/02-copy.md section 3 (#open-source). */
export const oss: PR[] = [
  {
    repo: 'digitalocean/nginxconfig.io',
    what: 'independent scrolling in split-column mode',
    merged: '2023-06',
    href: 'https://github.com/digitalocean/nginxconfig.io/pull/433',
  },
  {
    repo: 'digitalocean/nginxconfig.io',
    what: 'prettier via lint-staged',
    merged: '2023-10',
    href: 'https://github.com/digitalocean/nginxconfig.io/pull/448',
  },
  {
    repo: 'spatie/holidays',
    what: 'Nepal holiday calendar, with tests',
    merged: '2024-10',
    href: 'https://github.com/spatie/holidays/pull/247',
  },
  {
    repo: 'kritish-dhaubanjar/dynamodb-dashboard',
    what: '18 commits: validation, download, search fixes, demo videos',
    merged: '2023 → 2026',
    href: commits('kritish-dhaubanjar/dynamodb-dashboard'),
  },
  {
    repo: 'kritish-dhaubanjar/dev-auth-chrome-extension',
    what: 'Svelte rewrite, add-user form, token handling',
    merged: '2021 → 2022',
    href: commits('kritish-dhaubanjar/dev-auth-chrome-extension'),
  },
  {
    repo: 'benawad/dogehouse',
    what: 'Nepali translation, persist language',
    merged: '2021',
    href: commits('benawad/dogehouse'),
  },
  {
    repo: 'supabase/supabase',
    what: 'null-check fix; docs',
    merged: '2021 → 2023',
    href: commits('supabase/supabase'),
  },
];
