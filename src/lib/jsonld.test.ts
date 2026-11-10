import { describe, expect, it } from 'vitest';
import { buildGraph, buildPerson, serializeLd } from './jsonld';

describe('buildPerson', () => {
  const p = buildPerson();
  it('has the expected fields', () => {
    expect(p['@type']).toBe('Person');
    expect(p.name).toBe('Nihal Maskey');
    expect(p.url).toBe('https://nihal.com.np');
    expect(p.jobTitle).toBe('Lead Software Engineer');
    expect(p.worksFor).toEqual({
      '@type': 'Organization',
      name: 'Leapfrog Technology',
      url: 'https://lftechnology.com',
    });
    expect(p.address.addressLocality).toBe('Kathmandu');
    expect(p.address.addressCountry).toBe('NP');
  });
  it('sameAs covers the five socials', () => {
    expect(p.sameAs).toEqual([
      'https://github.com/maskeynihal',
      'https://www.linkedin.com/in/maskeynihal',
      'https://x.com/nihalmaskey',
      'https://www.instagram.com/maskeynihal',
      'https://nihalmaskey.hashnode.dev',
    ]);
  });
  it('graph has the person, website and profile page', () => {
    const g = buildGraph();
    expect(g['@graph'].map((n) => n['@type'])).toEqual([
      'Person',
      'WebSite',
      'ProfilePage',
    ]);
  });
  it('never mentions the client', () => {
    expect(JSON.stringify(buildGraph())).not.toMatch(/trayt/i);
  });
  it('throws when a social is missing', () => {
    expect(() => buildPerson([])).toThrow(/github/);
  });
});

describe('serializeLd', () => {
  it('escapes < so a script cannot be closed', () => {
    const out = serializeLd({ a: '</script><b>' });
    expect(out).not.toContain('<');
    expect(JSON.parse(out)).toEqual({ a: '</script><b>' });
  });
});
