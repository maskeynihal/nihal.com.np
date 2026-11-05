import { describe, expect, it } from 'vitest';
import { buildPerson, serializeLd } from './jsonld';

describe('buildPerson', () => {
  const p = buildPerson();
  it('has the expected fields', () => {
    expect(p['@context']).toBe('https://schema.org');
    expect(p['@type']).toBe('Person');
    expect(p.name).toBe('Nihal Maskey');
    expect(p.url).toBe('https://nihal.com.np');
    expect(p.jobTitle).toBe('Lead Engineer');
    expect(p.worksFor).toEqual({
      '@type': 'Organization',
      name: 'Leapfrog Technology',
      url: 'https://lftechnology.com',
    });
    expect(p.address.addressLocality).toBe('Kathmandu');
    expect(p.address.addressCountry).toBe('NP');
  });
  it('sameAs is github, linkedin, x from content', () => {
    expect(p.sameAs).toEqual([
      'https://github.com/maskeynihal',
      'https://www.linkedin.com/in/maskeynihal',
      'https://x.com/nihalmaskey',
    ]);
  });
  it('never mentions the client', () => {
    expect(JSON.stringify(p)).not.toMatch(/trayt/i);
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
