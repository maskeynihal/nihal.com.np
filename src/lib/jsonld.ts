import { site } from '../content/site';
import { copy } from '../content/copy';

const SAME_AS_LABELS = [
  'github',
  'linkedin',
  'x',
  'instagram',
  'hashnode',
] as const;

const PERSON_ID = `${site.url}/#person`;

export interface PersonLd {
  '@type': 'Person';
  '@id': string;
  name: string;
  url: string;
  image: string;
  email: string;
  jobTitle: string;
  description: string;
  worksFor: { '@type': 'Organization'; name: string; url: string };
  alumniOf: { '@type': 'CollegeOrUniversity'; name: string };
  address: {
    '@type': 'PostalAddress';
    addressLocality: string;
    addressCountry: string;
  };
  knowsAbout: string[];
  sameAs: string[];
}

export interface GraphLd {
  '@context': 'https://schema.org';
  '@graph': [
    PersonLd,
    {
      '@type': 'Organization';
      '@id': string;
      name: string;
      url: string;
      address: {
        '@type': 'PostalAddress';
        addressLocality: string;
        addressCountry: string;
      };
      founder: { '@id': string };
    },
    { '@type': 'WebSite'; '@id': string; url: string; name: string },
    {
      '@type': 'ProfilePage';
      '@id': string;
      url: string;
      name: string;
      mainEntity: { '@id': string };
    },
  ];
}

/** JSON-LD `Person` node. Facts come from `content/site.ts` and the contact socials only. */
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
    '@type': 'Person',
    '@id': PERSON_ID,
    name: p.name,
    url: site.url,
    image: new URL(site.og.image, site.url).href,
    email: p.email,
    jobTitle: p.jobTitle,
    description: copy.meta.description,
    worksFor: {
      '@type': 'Organization',
      name: p.employer.name,
      url: p.employer.url,
    },
    alumniOf: { '@type': 'CollegeOrUniversity', name: p.school },
    address: {
      '@type': 'PostalAddress',
      addressLocality: p.address.locality,
      addressCountry: p.address.country,
    },
    knowsAbout: [...p.knowsAbout],
    sameAs,
  };
}

/** The full `@graph`: Person, Daboo Spaces (founder), WebSite, ProfilePage. */
export function buildGraph(
  socials: readonly { label: string; href: string }[] = copy.contact.socials,
): GraphLd {
  const d = site.daboo;
  return {
    '@context': 'https://schema.org',
    '@graph': [
      buildPerson(socials),
      {
        '@type': 'Organization',
        '@id': `${d.url}/#organization`,
        name: d.name,
        url: d.url,
        address: {
          '@type': 'PostalAddress',
          addressLocality: d.locality,
          addressCountry: d.country,
        },
        founder: { '@id': PERSON_ID },
      },
      {
        '@type': 'WebSite',
        '@id': `${site.url}/#website`,
        url: site.url,
        name: site.person.name,
      },
      {
        '@type': 'ProfilePage',
        '@id': `${site.url}/#profile`,
        url: site.url,
        name: copy.meta.title,
        mainEntity: { '@id': PERSON_ID },
      },
    ],
  };
}

/** Safe to inline in a `<script>`: `<` is escaped so `</script>` cannot appear. */
export function serializeLd(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}
