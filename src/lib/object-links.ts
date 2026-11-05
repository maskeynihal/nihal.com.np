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
  return objects.map((o) => {
    const hash = o.target.slice(1);
    const panel = panels.find((p) => `work-${p.id}` === hash);
    if (panel)
      return {
        id: o.id,
        href: o.target,
        label: o.label,
        targetLabel: panel.title,
      };
    if ((SECTION_IDS as readonly string[]).includes(hash))
      return {
        id: o.id,
        href: o.target,
        label: o.label,
        targetLabel: rowLabel(hash as SectionId),
      };
    throw new Error(
      `object ${o.id} targets ${o.target}, which is not a rendered section or work panel`,
    );
  });
}
