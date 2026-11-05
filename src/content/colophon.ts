import type { EndMark } from './schema';

/**
 * Optional Nepali end mark under the colophon (design 12.3). Default is none: it is shown only
 * when the owner confirms it (`confirmed: true`), because the design bans decorative
 * foreign-language glyphs. The candidate string is the example in docs/specs/01-design-spec.md
 * section 12 question 3; it has not been confirmed or checked by the owner.
 */
export const endMark: EndMark = {
  text: 'अन्तिम बिसौनी',
  lang: 'ne',
  confirmed: false,
};
