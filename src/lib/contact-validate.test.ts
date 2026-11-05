import { describe, expect, it } from 'vitest';
import { invalidFields, validateField } from './contact-validate';

describe('validateField', () => {
  it('accepts ordinary addresses and trims', () => {
    expect(validateField('email', 'a@b.co')).toBe(true);
    expect(validateField('email', '  first.last+tag@sub.example.org ')).toBe(
      true,
    );
  });
  it('rejects addresses that cannot be mailed', () => {
    for (const v of ['', 'a', 'a@b', '@b.co', 'a@.co', 'a b@c.de', 'a@b c.de'])
      expect(validateField('email', v), v).toBe(false);
  });
  it('wants a sentence or two for the message', () => {
    expect(validateField('message', '')).toBe(false);
    expect(validateField('message', '   hi   ')).toBe(false);
    expect(validateField('message', 'Hello, a question.')).toBe(true);
  });
});

describe('invalidFields', () => {
  it('lists failing fields in form order', () => {
    expect(invalidFields({ email: 'x', message: '' })).toEqual([
      'email',
      'message',
    ]);
    expect(invalidFields({ email: 'a@b.co', message: '' })).toEqual([
      'message',
    ]);
    expect(
      invalidFields({ email: 'a@b.co', message: 'long enough text' }),
    ).toEqual([]);
  });
});
