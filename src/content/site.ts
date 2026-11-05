/**
 * Site-level facts for the head and JSON-LD `Person`. Source: docs/profile/nihal-maskey.md
 * (infobox and career). Nothing here comes from `pending.ts`; the client work is not named.
 * Social URLs are not repeated: they come from `copy.contact.socials`.
 */
export const site = {
  url: 'https://nihal.com.np',
  themeColor: '#1F3FE0',
  person: {
    name: 'Nihal Maskey',
    jobTitle: 'Lead Software Engineer',
    firstName: 'Nihal',
    lastName: 'Maskey',
    email: 'contact@nihal.com.np',
    school: 'Kantipur Engineering College',
    knowsAbout: [
      'JavaScript',
      'TypeScript',
      'React',
      'Node.js',
      'Laravel',
      'PHP',
      'AWS',
      'AWS Lambda',
      'Amazon SQS',
      'EventBridge',
      'Step Functions',
      'healthcare software',
      'HIPAA',
      'SOC 2',
      'engineering leadership',
    ],
    employer: {
      name: 'Leapfrog Technology',
      url: 'https://lftechnology.com',
    },
    address: { locality: 'Kathmandu', country: 'NP' },
  },
  daboo: {
    name: 'Daboo Spaces',
    url: 'https://daboospaces.com',
    locality: 'Sankhamul, Kathmandu',
    country: 'NP',
  },
  /** Formspree form id (docs/specs/00-product-brief.md: the existing endpoint `xanoenzo` stays). */
  formspreeId: 'xanoenzo',
  og: { image: '/og.png', width: 1200, height: 630 },
} as const;
