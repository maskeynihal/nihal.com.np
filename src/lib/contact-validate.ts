/**
 * Contact form rules (B-06b). Shared by the React island; the native form carries the same
 * rules as HTML attributes (`required`, `type="email"`) for visitors without scripts.
 */
export type ContactField = 'email' | 'message';

/** Shortest message that counts as "a sentence or two". */
export const MIN_MESSAGE = 10;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateField(field: ContactField, value: string): boolean {
  const v = value.trim();
  return field === 'email' ? EMAIL.test(v) : v.length >= MIN_MESSAGE;
}

/** Fields that fail, in form order. */
export function invalidFields(
  values: Record<ContactField, string>,
): ContactField[] {
  return (['email', 'message'] as const).filter(
    (f) => !validateField(f, values[f]),
  );
}
