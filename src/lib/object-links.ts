import type { BodyDef, WorkItem } from '../content/schema';
import { SECTION_IDS, rowLabel, type SectionId } from './sections';

export interface ObjectLink {
  id: BodyDef['id'];
  href: string;
  /** "arduino water monitor" */
  label: string;
  /** "car sensors": the section or work panel the object points at. */
  targetLabel: string;
}

/**
 * The object list, derived from the same `getObjects()` the poster alt uses and from the work
 * panels actually rendered, so a link can never point at a panel that is not on the page.
 * Throws when a target does not resolve (the build fails rather than ship a dead anchor).
 */
export function objectLinks(
  objects: readonly BodyDef[],
  panels: readonly Pick<WorkItem, 'id' | 'title'>[],
): ObjectLink[] {
  return objects.flatMap((o) => {
    if (!o.target) return [];
    const hash = o.target.slice(1);
    const panel = panels.find((p) => `work-${p.id}` === hash);
    if (panel)
      return [
        {
          id: o.id,
          href: o.target,
          label: o.label,
          targetLabel: panel.title,
        },
      ];
    if ((SECTION_IDS as readonly string[]).includes(hash))
      return [
        {
          id: o.id,
          href: o.target,
          label: o.label,
          targetLabel: rowLabel(hash as SectionId),
        },
      ];
    throw new Error(
      `object ${o.id} targets ${o.target}, which is not a rendered section or work panel`,
    );
  });
}

export interface ObjectAction {
  id: string;
  /** "coffee mug" */
  label: string;
  /** "take a sip": what the tap does. */
  act: string;
}

/**
 * The objects a tap does something to without leaving the page (the developer, the chair, the lamp,
 * the keyboard, the balls and letters): one button each in the object list, the keyboard path to the
 * same reaction. Objects with a section are links (`objectLinks`) and are left out here.
 */
export function objectActions(objects: readonly BodyDef[]): ObjectAction[] {
  return objects.flatMap((o) =>
    !o.target && o.act ? [{ id: o.id, label: o.label, act: o.act }] : [],
  );
}

/**
 * The handset on the desk is part of the drawer's model, not an object of its own, so it has no row
 * in the object list: this is its button (shown whenever the drawer is). It raises the desk for
 * standing work, and lowers it again.
 */
export function handsetAction(objects: readonly BodyDef[]): ObjectAction[] {
  return objects.some((o) => o.id === 'drawer')
    ? [
        {
          id: 'handset',
          label: 'desk height handset',
          act: 'stand up or sit down',
        },
      ]
    : [];
}
