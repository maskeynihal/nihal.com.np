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
  'space-hog',
  'car-sensors',
  'pac-man',
] as const;

export const WorkItem = z.strictObject({
  id: z.enum(WORK_IDS),
  title: text,
  dateLine: text,
  meta: text,
  body: z.array(text).min(1),
  frameNote: text.optional(),
  /** A playable embed (B-08): the cross-origin game page, also linked directly. */
  arcade: z.strictObject({ href: url }).optional(),
  links: z.array(Link),
  confirmed: z.boolean(),
});

export const PR = z.strictObject({
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

/** Exactly: #desk #work #work-<work id> #open-source #writing #cv #contact. */
export const SECTION_TARGET = new RegExp(
  `^#(desk|about|work|work-(${WORK_IDS.join('|')})|open-source|writing|cv|contact)$`,
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

export const EndMark = z.strictObject({
  text: text,
  lang: z.string().regex(/^[a-z]{2,3}$/),
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
    'ball-s',
    'ball-m',
    'ball-l',
    'pacman-1',
    'pacman-2',
    'letter-n',
    'letter-i',
    'letter-h',
    'letter-a',
    'letter-l',
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
  callouts: z.array(z.strictObject({ anchor: vec3, text })),
  /** Section id a tap goes to. Decorative objects (balls, letters) have none. */
  target: z
    .string()
    .regex(SECTION_TARGET, 'target must be a section id')
    .optional(),
  label: text,
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
    rows: z.array(text).length(8),
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
    /** Visible line under the name, above the intro. */
    kicker: text,
    selected: z.enum(['A', 'B', 'C']),
    options: z.strictObject({ A: text, B: text, C: text }),
    email: z.email(),
    timeLabel: text,
    /** Template; {rev} is the build month as YYYY.MM. */
    revLine: text,
    /** Second action next to the email: link to #work. */
    seeWork: text,
    dragHint: text,
    reset: text,
    skip: text,
    oledCaption: text,
  }),
  headings: z.strictObject({
    about: text,
    work: text,
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
  }),
  openSource: z.strictObject({
    intro: text,
    columns: z.tuple([text, text, text]),
    footer: text,
  }),
  writing: z.strictObject({ intro: text, all: text, allHref: url }),
  cv: z.strictObject({
    note: text,
    intro: text,
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
  colophon: z.strictObject({
    owner: text,
    copyright: text,
    source: text,
    sourceHref: url,
    built: text,
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
export type PR = z.infer<typeof PR>;
export type Post = z.infer<typeof Post>;
export type CvRow = z.infer<typeof CvRow>;
export type ClockDef = z.infer<typeof ClockDef>;
export type EndMark = z.infer<typeof EndMark>;
export type BodyDef = z.infer<typeof BodyDef>;
export type Holiday = z.infer<typeof Holiday>;
export type Copy = z.infer<typeof Copy>;
export type GithubData = z.infer<typeof GithubData>;

export const WorkList = z.array(WorkItem).length(5);
export const PRList = z.array(PR);
export const PostList = z.array(Post);
export const CvList = z.array(CvRow);
export const ClockList = z.array(ClockDef).length(3);
export const BodyList = z.array(BodyDef);
export const HolidayList = z.array(Holiday);
