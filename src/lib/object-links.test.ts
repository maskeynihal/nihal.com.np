import { describe, expect, it } from 'vitest';
import { objectActions, objectLinks } from './object-links';
import { getObjects, getWork } from '../content';
import { objects } from '../content/objects';
import { work } from '../content/work';

describe('objectLinks', () => {
  it('labels every shown object with the page it opens', () => {
    const links = objectLinks(getObjects(), getWork());
    expect(links.map((l) => `${l.label} → ${l.targetLabel}`)).toEqual([
      'monitor → projects',
      'phone → contact',
      'arduino water monitor → car sensors',
      'clocks → contact',
      'calendar → open source',
      'pac-man ghost → pac-man',
      'laptop → projects',
    ]);
    expect(links.map((l) => l.href)).toEqual([
      '#projects',
      '#contact',
      '#work-car-sensors',
      '#contact',
      '#open-source',
      '#work-pac-man',
      '#projects',
    ]);
  });
  it('follows the shown set: nothing for hidden objects', () => {
    const links = objectLinks(getObjects(), getWork());
    expect(links.map((l) => l.id)).not.toContain('cruiser');
    // Objects that only react (the developer, the lamp, the letters) have no target and no link.
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

describe('objectActions', () => {
  it('gives every shown object that has no section a button, and none to a link', () => {
    const actions = objectActions(getObjects());
    const linked = new Set<string>(
      objectLinks(getObjects(), getWork()).map((l) => l.id),
    );
    for (const a of actions) expect(linked.has(a.id)).toBe(false);
    // everything on the desk is reachable: a link or a button
    for (const o of getObjects())
      expect(linked.has(o.id) || actions.some((a) => a.id === o.id), o.id).toBe(
        true,
      );
    expect(actions.map((a) => a.id)).toContain('lamp');
  });
});
