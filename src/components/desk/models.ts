// `?no-inline`: Vite would otherwise inline the smallest GLB as a data: URL, which the CSP
// (connect-src 'self') forbids fetching.
import sheet from '../../assets/models/sheet.glb?url&no-inline';
import table from '../../assets/models/table.glb?url&no-inline';
import arduino from '../../assets/models/arduino.glb?url&no-inline';
import clock from '../../assets/models/clock.glb?url&no-inline';
import calendar from '../../assets/models/calendar.glb?url&no-inline';
import ghost from '../../assets/models/ghost.glb?url&no-inline';
import laptop from '../../assets/models/laptop.glb?url&no-inline';
import ballL from '../../assets/models/ball-l.glb?url&no-inline';
import desk from '../../assets/models/desk.glb?url&no-inline';
import chair from '../../assets/models/chair.glb?url&no-inline';
import dev from '../../assets/models/dev.glb?url&no-inline';
import monitor from '../../assets/models/monitor.glb?url&no-inline';
import keyboard from '../../assets/models/keyboard.glb?url&no-inline';
import mouse from '../../assets/models/mouse.glb?url&no-inline';
import lamp from '../../assets/models/lamp.glb?url&no-inline';
import mug from '../../assets/models/mug.glb?url&no-inline';
import headphones from '../../assets/models/headphones.glb?url&no-inline';
import phone from '../../assets/models/phone.glb?url&no-inline';
import plant from '../../assets/models/plant.glb?url&no-inline';
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
  table: () => Promise.resolve(table),
  arduino: () => Promise.resolve(arduino),
  clock: () => Promise.resolve(clock),
  calendar: () => Promise.resolve(calendar),
  ghost: () => Promise.resolve(ghost),
  laptop: () => Promise.resolve(laptop),
  'ball-l': () => Promise.resolve(ballL),
  desk: () => Promise.resolve(desk),
  chair: () => Promise.resolve(chair),
  dev: () => Promise.resolve(dev),
  monitor: () => Promise.resolve(monitor),
  keyboard: () => Promise.resolve(keyboard),
  mouse: () => Promise.resolve(mouse),
  lamp: () => Promise.resolve(lamp),
  mug: () => Promise.resolve(mug),
  headphones: () => Promise.resolve(headphones),
  phone: () => Promise.resolve(phone),
  plant: () => Promise.resolve(plant),
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
