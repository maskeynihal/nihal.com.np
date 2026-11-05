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
    jobTitle: 'Lead Engineer',
    employer: {
      name: 'Leapfrog Technology',
      url: 'https://lftechnology.com',
    },
    address: { locality: 'Kathmandu', country: 'NP' },
  },
  og: { image: '/og.png', width: 1200, height: 630 },
} as const;
