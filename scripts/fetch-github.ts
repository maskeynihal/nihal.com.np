import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { GithubData } from '../src/content/schema';
import { work } from '../src/content/work';
import { oss } from '../src/content/oss';

const OUT = fileURLToPath(
  new URL('../src/content/generated/github.json', import.meta.url),
);
const API = 'https://api.github.com';
/** `is:public` keeps private-repo activity out of the counts, even with a token. */
export const MERGED_Q =
  'author:maskeynihal type:pr is:merged is:public -user:maskeynihal';
export const CLOSED_Q =
  'author:maskeynihal type:pr is:unmerged is:closed is:public -user:maskeynihal';

type Fetch = typeof fetch;

/** owner/name for every repo that work.ts and oss.ts reference. */
export function collectRepos(): string[] {
  const set = new Set<string>();
  for (const row of oss) set.add(row.repo);
  for (const item of work)
    for (const l of item.links) {
      const m = /^https:\/\/github\.com\/([^/]+)\/([^/?#]+)\/?$/.exec(l.href);
      if (m) set.add(`${m[1]}/${m[2]}`);
    }
  return [...set].sort();
}

async function getJson(
  f: Fetch,
  url: string,
  token: string | undefined,
): Promise<unknown> {
  const res = await f(url, {
    headers: {
      accept: 'application/vnd.github+json',
      'user-agent': 'nihal.com.np-fetch-github',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
  return res.json();
}

const count = async (f: Fetch, q: string, token: string | undefined) => {
  const j = (await getJson(
    f,
    `${API}/search/issues?q=${encodeURIComponent(q)}&per_page=1`,
    token,
  )) as { total_count?: unknown };
  if (typeof j.total_count !== 'number') throw new Error('no total_count');
  return j.total_count;
};

export async function buildGithubData(
  f: Fetch,
  token: string | undefined,
  now = new Date(),
): Promise<GithubData> {
  const merged = await count(f, MERGED_Q, token);
  const closed = await count(f, CLOSED_Q, token);
  const repos: GithubData['repos'] = {};
  for (const name of collectRepos()) {
    const j = (await getJson(f, `${API}/repos/${name}`, token)) as {
      stargazers_count: number;
      pushed_at: string;
      private?: boolean;
    };
    if (j.private === true) continue; // public repos only
    repos[name] = { stars: j.stargazers_count, pushedAt: j.pushed_at };
  }
  return GithubData.parse({
    fetchedAt: now.toISOString(),
    merged,
    closed,
    repos,
  });
}

/** Writes `path` on success. On any failure keeps the existing file, warns, and returns false. */
export async function run(
  f: Fetch = fetch,
  token: string | undefined = process.env['GITHUB_TOKEN'],
  path = OUT,
): Promise<boolean> {
  try {
    const data = await buildGithubData(f, token);
    writeFileSync(path, JSON.stringify(data, null, 2) + '\n');
    console.log(
      `github:fetch wrote ${path} (${data.merged} merged, ${data.closed} closed)`,
    );
    return true;
  } catch (err) {
    let kept = 'no existing file';
    try {
      GithubData.parse(JSON.parse(readFileSync(path, 'utf8')));
      kept = 'kept the committed file';
    } catch {
      /* nothing usable on disk */
    }
    console.warn(
      `github:fetch warning: ${err instanceof Error ? err.message : String(err)}; ${kept}.`,
    );
    return false;
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  await run();
  process.exit(0);
}
