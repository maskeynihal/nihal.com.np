// `?no-inline`: Vite would otherwise inline the smallest GLB as a data: URL, which the CSP
// (connect-src 'self') forbids fetching.
import sheet from '../../assets/models/sheet.glb?url&no-inline';
import arduino from '../../assets/models/arduino.glb?url&no-inline';
import clock from '../../assets/models/clock.glb?url&no-inline';
import calendar from '../../assets/models/calendar.glb?url&no-inline';
import ghost from '../../assets/models/ghost.glb?url&no-inline';

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
