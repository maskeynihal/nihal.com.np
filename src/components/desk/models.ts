// `?no-inline`: Vite would otherwise inline the smallest GLB as a data: URL, which the CSP
// (connect-src 'self') forbids fetching.
import sheet from '../../assets/models/sheet.glb?url&no-inline';
import arduino from '../../assets/models/arduino.glb?url&no-inline';
import clock from '../../assets/models/clock.glb?url&no-inline';
import calendar from '../../assets/models/calendar.glb?url&no-inline';
import ghost from '../../assets/models/ghost.glb?url&no-inline';
import laptop from '../../assets/models/laptop.glb?url&no-inline';
import ballS from '../../assets/models/ball-s.glb?url&no-inline';
import ballM from '../../assets/models/ball-m.glb?url&no-inline';
import ballL from '../../assets/models/ball-l.glb?url&no-inline';
import pacman from '../../assets/models/pacman.glb?url&no-inline';
import letterN from '../../assets/models/letter-n.glb?url&no-inline';
import letterI from '../../assets/models/letter-i.glb?url&no-inline';
import letterH from '../../assets/models/letter-h.glb?url&no-inline';
import letterA from '../../assets/models/letter-a.glb?url&no-inline';
import letterL from '../../assets/models/letter-l.glb?url&no-inline';

/**
 * GLB urls by model name (the file name without `.glb`). The toy Land Cruiser is unconfirmed:
 * it is imported only in owner-preview builds, so a normal build neither lists nor emits it.
 */
const urls: Record<string, () => Promise<string>> = {
  sheet: () => Promise.resolve(sheet),
  arduino: () => Promise.resolve(arduino),
  clock: () => Promise.resolve(clock),
  calendar: () => Promise.resolve(calendar),
  ghost: () => Promise.resolve(ghost),
  laptop: () => Promise.resolve(laptop),
  'ball-s': () => Promise.resolve(ballS),
  'ball-m': () => Promise.resolve(ballM),
  'ball-l': () => Promise.resolve(ballL),
  pacman: () => Promise.resolve(pacman),
  'letter-n': () => Promise.resolve(letterN),
  'letter-i': () => Promise.resolve(letterI),
  'letter-h': () => Promise.resolve(letterH),
  'letter-a': () => Promise.resolve(letterA),
  'letter-l': () => Promise.resolve(letterL),
};
if (import.meta.env.PUBLIC_SHOW_UNCONFIRMED === '1') {
  urls['cruiser'] = () =>
    import('../../assets/models/cruiser.glb?url&no-inline').then(
      (m) => m.default,
    );
}

export async function resolveModelUrls(
  names: readonly string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  await Promise.all(
    [...new Set(names)].map(async (name) => {
      const load = urls[name];
      if (load) out[name] = await load();
    }),
  );
  return out;
}
