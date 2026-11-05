import { describe, expect, it } from 'vitest';
import { objectLinks } from './object-links';
import { getObjects, getWork } from '../content';
import { objects } from '../content/objects';
import { work } from '../content/work';

describe('objectLinks', () => {
  it('labels every shown object with the page it opens', () => {
    const links = objectLinks(getObjects(), getWork());
    expect(links.map((l) => `${l.label} → ${l.targetLabel}`)).toEqual([
      'arduino water monitor → car sensors',
      'clocks → contact',
      'calendar → open source',
      'pac-man ghost → pac-man',
      'laptop → work',
    ]);
    expect(links.map((l) => l.href)).toEqual([
      '#work-car-sensors',
      '#contact',
      '#open-source',
      '#work-pac-man',
      '#work',
    ]);
  });
  it('follows the shown set: nothing for hidden objects', () => {
    const links = objectLinks(getObjects(), getWork());
    expect(links.map((l) => l.id)).not.toContain('cruiser');
    // Decorative objects (balls, letters, pac-man figures) have no target and no link.
    expect(links).toHaveLength(getObjects().filter((o) => o.target).length);
  });
  it('resolves every object in the full set when all panels exist', () => {
    expect(objectLinks(objects, work)).toHaveLength(
      objects.filter((o) => o.target).length,
    );
  });
  it('throws when a target panel is not rendered', () => {
    const noCar = getWork().filter((w) => w.id !== 'car-sensors');
    expect(() => objectLinks(getObjects(), noCar)).toThrow(/work-car-sensors/);
  });
});
