import { describe, expect, it } from 'vitest';
import { copy } from '../content/copy';
import { indexRows, SECTION_IDS } from './sections';

describe('sections', () => {
  it('maps every nav row in copy to a section id, in order', () => {
    const rows = indexRows();
    expect(rows.map((r) => r.label)).toEqual(copy.nav.rows);
    expect(rows.map((r) => r.id)).toEqual([...SECTION_IDS]);
  });
});
