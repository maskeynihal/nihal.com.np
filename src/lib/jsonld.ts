import { site } from '../content/site';
import { copy } from '../content/copy';

const SAME_AS_LABELS = ['github', 'linkedin', 'x'] as const;

export interface PersonLd {
  '@context': 'https://schema.org';
  '@type': 'Person';
  name: string;
  url: string;
  jobTitle: string;
  worksFor: { '@type': 'Organization'; name: string; url: string };
  address: {
    '@type': 'PostalAddress';
    addressLocality: string;
    addressCountry: string;
  };
  sameAs: string[];
}

/** JSON-LD `Person`. Facts come from `content/site.ts` and the contact socials only. */
export function buildPerson(
  socials: readonly { label: string; href: string }[] = copy.contact.socials,
): PersonLd {
  const p = site.person;
  const sameAs = SAME_AS_LABELS.map((label) => {
    const s = socials.find((x) => x.label === label);
    if (!s) throw new Error(`JSON-LD: no "${label}" link in contact.socials`);
    return s.href;
  });
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: p.name,
    url: site.url,
    jobTitle: p.jobTitle,
    worksFor: {
      '@type': 'Organization',
      name: p.employer.name,
      url: p.employer.url,
    },
    address: {
      '@type': 'PostalAddress',
      addressLocality: p.address.locality,
      addressCountry: p.address.country,
    },
    sameAs,
  };
}

/** Safe to inline in a `<script>`: `<` is escaped so `</script>` cannot appear. */
export function serializeLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
