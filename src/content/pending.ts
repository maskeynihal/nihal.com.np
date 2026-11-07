/**
 * Unresolved [CONFIRM]/[ASK] notes and not-yet-confirmed candidate strings.
 *
 * BUILD-TIME ONLY. Import this from the validator, the build-time poster alt
 * and tests. Never import it from a component, a client `<script>` or anything a
 * client script imports. `pnpm check:leaks` fails the build output if it
 * finds the sentinel, a `[CONFIRM`/`[ASK` marker or any string below in dist/.
 */
export const PENDING_SENTINEL = '__PENDING_SENTINEL__';

export const pending = {
  marker: PENDING_SENTINEL,
  copy: [
    '[CONFIRM] contact.lead: append "I reply within a day or two."',
    '[ASK] contact clocks: cities 2 and 3 (Kathmandu is the only confirmed clock).',
    '[CONFIRM] contact.overlap: regions sentence ("My mornings are Australia\'s afternoon and the US West Coast\'s evening.")',
    '[Q5] cv: resume (pdf) link only if a live PDF exists (live URL returned 404 on 2026-11-05).',
    '[CONFIRM] poster/objects: Land Cruiser (see objects.ts cruiser).',
  ],
  work: {
    trayt: [
      '[CONFIRM] whether the client name "Trayt Health" may appear (title, meta, cv).',
      "[ASK] one sentence on what was actually hard, in the owner's words.",
      '[CONFIRM] numbers before adding: 20% smaller frontend bundle, API response times over 200% faster, and how each was measured.',
    ],
    'tz-converter': ['[ASK] hardest part, one sentence.'],
    'space-hog': ['[ASK] hardest part; largest volume tested.'],
    'car-sensors': [
      '[CONFIRM] vehicle details held back: two Land Cruisers; LC78 for the UNO R4 unit; HJ60 with an ESP32-S3 reading the factory coolant sender and drawing temperature on a TFT. Vehicle ownership is unverified in the profile.',
    ],
    'pac-man': [
      '[ASK] who gets frozen in two-player mode.',
      '[ASK] which path-finding algorithm.',
    ],
  },
  /** Keyed by `${when} | ${role}`. */
  cv: {
    '2025 → | Lead Engineer': ['[CONFIRM] append ", for Trayt Health" to org.'],
    '2023 → 2025 | Senior Software Engineer': [
      '[CONFIRM] append ", for Trayt Health" to org.',
    ],
  },
  objects: {
    'clock-2': ['[ASK] city 2 for the second desk clock and its callout.'],
    'clock-3': ['[ASK] city 3 for the third desk clock and its callout.'],
    cruiser: [
      "[CONFIRM] toy Land Cruiser (HJ60) is the owner's; no generic fallback if unconfirmed.",
    ],
  },
  /** Candidate strings that become displayed only once confirmed. */
  candidates: {
    cruiserAltPhrase: 'a toy Land Cruiser',
    /** Appended to the cv org of the two Trayt rows once the client name is confirmed. */
    cvOrgSuffix: 'Leapfrog Technology, for Trayt Health',
  },
} as const;
