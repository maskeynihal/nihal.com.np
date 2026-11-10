import { z } from 'zod';

/** https links only, plus mailto: for the contact address. */
const url = z
  .url()
  .refine((v) => v.startsWith('https://') || v.startsWith('mailto:'), {
    message: 'URL must be https:// or mailto:',
  });

const text = z.string().min(1);
const vec3 = z.tuple([z.number(), z.number(), z.number()]);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

export const Link = z.strictObject({ label: text, href: url });

export const WORK_IDS = [
  'trayt',
  'tz-converter',
  'sprintnudge',
  'underhood',
  'space-hog',
  'car-sensors',
  'pac-man',
] as const;

/** Project cards are grouped; a group with no visible card is not drawn. */
export const WORK_GROUPS = ['client', 'products', 'hardware-games'] as const;

export const WorkGroup = z.strictObject({
  id: z.enum(WORK_GROUPS),
  title: text,
  note: text,
});

export const WorkItem = z.strictObject({
  id: z.enum(WORK_IDS),
  group: z.enum(WORK_GROUPS),
  title: text,
  dateLine: text,
  /** Platform or where it runs; shown inside the card's details. */
  meta: text,
  /** One or two lines, always visible on the card. */
  summary: text,
  /** Short stack and platform chips under the summary. */
  tags: z.array(text).min(1),
  /** Primary call to action: the project's own site when it has one, otherwise its repo. */
  cta: Link.optional(),
  /** The longer description, collapsed by default (still in the HTML). */
  body: z.array(text).min(1),
  frameNote: text.optional(),
  /** A playable embed (B-08): the cross-origin game page, also linked directly. */
  arcade: z.strictObject({ href: url }).optional(),
  /** Secondary links (store listings, repo, write-up). */
  links: z.array(Link),
  confirmed: z.boolean(),
});

export const PR = z.strictObject({
  /** `own`: a public project of mine. `contribution`: work merged into someone else's repo. */
  kind: z.enum(['own', 'contribution']),
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/, 'expected owner/name'),
  what: text,
  merged: text,
  href: url,
});

export const Post = z.strictObject({
  date: isoDate,
  title: text,
  summary: text,
  href: url,
});

export const CvRow = z.strictObject({
  when: text,
  role: text,
  org: text,
  /** Short bullets under the role; plain list, readable without JS. */
  details: z.array(text).optional(),
  confirmed: z.boolean(),
});

/** Exactly: #desk #projects #work-<work id> #open-source #writing #cv #contact. */
export const SECTION_TARGET = new RegExp(
  `^#(desk|about|projects|work-(${WORK_IDS.join('|')})|open-source|writing|cv|contact)$`,
);

/** An IANA zone the runtime can format (checked with Intl, no zone table). */
const timeZone = z.string().refine(
  (v) => {
    try {
      new Intl.DateTimeFormat('en-GB', { timeZone: v });
      return true;
    } catch {
      return false;
    }
  },
  { message: 'expected an IANA time zone name' },
);

export const ClockDef = z.strictObject({
  id: z.enum(['clock-ktm', 'clock-2', 'clock-3']),
  city: text,
  timeZone,
  confirmed: z.boolean(),
});

export const BodyDef = z.strictObject({
  id: z.enum([
    'arduino',
    'clock-ktm',
    'clock-2',
    'clock-3',
    'calendar',
    'ghost',
    'cruiser',
    'laptop',
    'ball-l',
    'pacman-1',
    'pacman-2',
    'letter-n',
    'letter-i',
    'letter-h',
    'letter-a',
    'letter-l',
    'chair',
    'drawer',
    'dev',
    'monitor',
    'keyboard',
    'mouse',
    'lamp',
    'mug',
    'headphones',
    'phone',
    'plant',
  ]),
  model: text,
  home: z.strictObject({
    p: vec3,
    q: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  }),
  collider: z.strictObject({
    kind: z.enum(['cuboid', 'ball', 'capsule']),
    args: z.array(z.number()).min(1),
    offset: vec3,
  }),
  mass: z.number().positive(),
  kinematicWhenIdle: z.boolean().optional(),
  /** Section id a tap goes to. Decorative objects (balls, letters) have none. */
  target: z
    .string()
    .regex(SECTION_TARGET, 'target must be a section id')
    .optional(),
  label: text,
  /** What a tap does when it is not a link: the words for the keyboard path (a button in the object list). */
  act: text.optional(),
  confirmed: z.boolean(),
});

export const Holiday = z.strictObject({
  bsDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected BS YYYY-MM-DD'),
  adDate: isoDate,
  name: text,
  source: url,
});

export const Copy = z.strictObject({
  nav: z.strictObject({
    label: text,
    rows: z.array(text).length(7),
  }),
  prefs: z.strictObject({
    motion: text,
    sound: text,
    on: text,
    off: text,
    system: text,
  }),
  titleBlock: z.strictObject({
    name: text,
    /** Visible line under the name, above the sentence. */
    kicker: text,
    line: text,
    email: z.email(),
    timeLabel: text,
    /** Second action next to the email: link to #projects. */
    seeProjects: text,
    reset: text,
    skip: text,
    /** Spoken with the board's entry in the object list: the screen shows invented readings. */
    oledNote: text,
  }),
  headings: z.strictObject({
    about: text,
    projects: text,
    openSource: text,
    writing: text,
    cv: text,
    contact: text,
  }),
  about: z.strictObject({
    paragraphs: z.tuple([text, text, text]),
    /** Fourth paragraph with a link in the middle: before + link + after. */
    daboo: z.strictObject({ before: text, link: Link, after: text }),
    facts: z.array(z.strictObject({ label: text, value: text })),
  }),
  work: z.strictObject({
    intro: text,
    play: text,
    leave: text,
    openNewTab: text,
    more: text,
    stack: text,
    scrollLeft: text,
    scrollRight: text,
  }),
  openSource: z.strictObject({
    columns: z.tuple([text, text, text]),
    since: text,
    ownHeading: text,
    contribHeading: text,
  }),
  writing: z.strictObject({ intro: text, all: text, allHref: url }),
  cv: z.strictObject({
    cards: z
      .array(z.strictObject({ label: text, title: text, text }))
      .length(3),
  }),
  contact: z.strictObject({
    lead: text,
    copied: text,
    overlap: text,
    socials: z.array(Link),
    form: z.strictObject({
      name: text,
      email: text,
      subject: text,
      message: text,
      send: text,
    }),
    success: text,
    errors: z.strictObject({
      email: text,
      message: text,
      network: text,
    }),
  }),
  footer: z.strictObject({
    copyright: text,
    source: text,
    sourceHref: url,
  }),
  meta: z.strictObject({
    title: text,
    description: text,
    keywords: text,
    ogAlt: text,
  }),
  notFound: z.strictObject({
    title: text,
    description: text,
    heading: text,
    sheet: text,
    body: text,
    back: text,
  }),
  sent: z.strictObject({
    title: text,
    description: text,
    heading: text,
    body: text,
    back: text,
  }),
  desk: z.strictObject({
    hint: text,
    dismiss: text,
  }),
  status: z.strictObject({
    loading: text,
    off: text,
    lost: text,
  }),
  consoleLine: text,
});

/** `generated/github.json`, written by `scripts/fetch-github.ts`. */
export const GithubData = z.strictObject({
  fetchedAt: z.iso.datetime({ offset: true }),
  merged: z.number().int().nonnegative(),
  closed: z.number().int().nonnegative(),
  repos: z.record(
    z.string(),
    z.strictObject({
      stars: z.number().int().nonnegative(),
      pushedAt: z.iso.datetime({ offset: true }),
    }),
  ),
});

export type Link = z.infer<typeof Link>;
export type WorkItem = z.infer<typeof WorkItem>;
export type WorkGroup = z.infer<typeof WorkGroup>;
export type PR = z.infer<typeof PR>;
export type Post = z.infer<typeof Post>;
export type CvRow = z.infer<typeof CvRow>;
export type ClockDef = z.infer<typeof ClockDef>;
export type BodyDef = z.infer<typeof BodyDef>;
export type Holiday = z.infer<typeof Holiday>;
export type Copy = z.infer<typeof Copy>;
export type GithubData = z.infer<typeof GithubData>;

export const WorkList = z.array(WorkItem).length(7);
export const PRList = z
  .array(PR)
  .refine(
    (rows) =>
      new Set(rows.map((r) => `${r.kind}:${r.repo}`)).size === rows.length,
    { message: 'one row per repo' },
  );
export const PostList = z.array(Post);
export const CvList = z.array(CvRow);
export const ClockList = z.array(ClockDef).length(3);
export const BodyList = z.array(BodyDef);
export const HolidayList = z.array(Holiday);
