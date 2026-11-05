// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CLOSED_Q, MERGED_Q, collectRepos, run } from './fetch-github';

const prior = JSON.stringify({
  fetchedAt: '2026-11-05T00:00:00Z',
  merged: 41,
  closed: 18,
  repos: {},
});

function tmpFile() {
  const p = join(mkdtempSync(join(tmpdir(), 'ghf-')), 'github.json');
  writeFileSync(p, prior);
  return p;
}

describe('fetch-github', () => {
  it('collects repos from work and oss', () => {
    const r = collectRepos();
    expect(r).toContain('spatie/holidays');
    expect(r).toContain('maskeynihal/space-hog');
  });

  it('keeps the committed file and exits cleanly when fetch rejects', async () => {
    const p = tmpFile();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const ok = await run(
      vi.fn().mockRejectedValue(new Error('offline')),
      undefined,
      p,
    );
    expect(ok).toBe(false);
    expect(readFileSync(p, 'utf8')).toBe(prior);
    expect(warn).toHaveBeenCalledOnce();
    warn.mockRestore();
  });

  it('keeps the file on HTTP 403 (rate limit)', async () => {
    const p = tmpFile();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = vi
      .fn()
      .mockResolvedValue({ ok: false, status: 403, json: async () => ({}) });
    expect(await run(f, undefined, p)).toBe(false);
    expect(readFileSync(p, 'utf8')).toBe(prior);
    warn.mockRestore();
  });

  it('writes fresh data on success and sends the token', async () => {
    const p = tmpFile();
    const f = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      return {
        ok: true,
        status: 200,
        json: async () =>
          u.includes('/search/issues')
            ? { total_count: 7 }
            : { stargazers_count: 3, pushed_at: '2026-11-01T00:00:00Z' },
      } as Response;
    });
    expect(await run(f as unknown as typeof fetch, 'tok', p)).toBe(true);
    const out = JSON.parse(readFileSync(p, 'utf8')) as {
      merged: number;
      repos: Record<string, unknown>;
    };
    expect(out.merged).toBe(7);
    expect(Object.keys(out.repos).length).toBeGreaterThan(5);
    const init = (f.mock.calls[0] as unknown[] | undefined)?.[1] as
      RequestInit | undefined;
    expect((init?.headers as Record<string, string>)['authorization']).toBe(
      'Bearer tok',
    );
  });

  it('restricts both search queries to public repos', async () => {
    expect(MERGED_Q).toContain('is:public');
    expect(CLOSED_Q).toContain('is:public');
    const p = tmpFile();
    const f = vi.fn(async (url: string | URL | Request) => {
      const u = String(url);
      return {
        ok: true,
        status: 200,
        json: async () =>
          u.includes('/search/issues')
            ? { total_count: 2 }
            : {
                stargazers_count: 1,
                pushed_at: '2026-11-01T00:00:00Z',
                private: u.endsWith('/maskeynihal/space-hog'),
              },
      } as Response;
    });
    expect(await run(f as unknown as typeof fetch, undefined, p)).toBe(true);
    const searches = f.mock.calls
      .map((c) => decodeURIComponent(String(c[0])))
      .filter((u) => u.includes('/search/issues'));
    expect(searches).toHaveLength(2);
    for (const u of searches) expect(u).toContain('is:public');
    const out = JSON.parse(readFileSync(p, 'utf8')) as {
      repos: Record<string, unknown>;
    };
    expect(out.repos).not.toHaveProperty('maskeynihal/space-hog');
    expect(out.repos).toHaveProperty('spatie/holidays');
  });
});
