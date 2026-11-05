import { describe, expect, it } from 'vitest';
import { isTicketId } from './review-id.ts';

describe('isTicketId', () => {
  it.each(['A-08', 'B-06a', 'B-06b', 'E-11', 'F-02'])('accepts %s', (id) => {
    expect(isTicketId(id)).toBe(true);
  });
  it.each([
    '',
    'foo',
    'A-8',
    'A-008',
    'G-01',
    'a-08',
    'B-06A',
    'B-06ab',
    'A-08 ',
  ])('rejects %j', (id) => {
    expect(isTicketId(id)).toBe(false);
  });
});
