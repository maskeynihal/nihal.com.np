import { copy } from '../content/copy';

/** Section ids in page order. The sheet index rows (`copy.nav.rows`) map onto them one to one. */
export const SECTION_IDS = [
  'desk',
  'about',
  'work',
  'open-source',
  'writing',
  'cv',
  'contact',
  'colophon',
] as const;

export type SectionId = (typeof SECTION_IDS)[number];

/** Index rows: the copy label with the id it links to. Throws if the two lists drift apart. */
export function indexRows(): { id: SectionId; label: string }[] {
  const labels = copy.nav.rows;
  return SECTION_IDS.map((id, i) => {
    const label = labels[i];
    if (label === undefined || label.replaceAll(' ', '-') !== id)
      throw new Error(
        `nav row ${i} (${label}) does not match section id ${id}`,
      );
    return { id, label };
  });
}

/** The index label for one section (used as the heading where copy has no separate heading). */
export function rowLabel(id: SectionId): string {
  const row = indexRows().find((r) => r.id === id);
  if (!row) throw new Error(`no index row for ${id}`);
  return row.label;
}
